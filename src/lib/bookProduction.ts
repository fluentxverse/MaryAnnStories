export type ProductionStepKind = "cover" | "back_cover" | "page";

export type ProductionImageStatus = "idle" | "generated" | "saved";

export type ProductionStep = {
  id: string;
  label: string;
  kind: ProductionStepKind;
};

export type StepQaWarning = {
  id: string;
  label: string;
  detail: string;
  severity: "warning" | "blocker";
};

export type PublishChecklistItem = {
  id: string;
  label: string;
  detail: string;
  status: "pass" | "warning" | "blocker";
};

export type PublishValidationResult = {
  ready: boolean;
  blockers: PublishChecklistItem[];
  warnings: PublishChecklistItem[];
  items: PublishChecklistItem[];
};

type StepQaInput = {
  step: ProductionStep;
  prompt: string;
  storyText: string;
  status: ProductionImageStatus;
  sameCastRisk: boolean;
  expectedAspectRatioLabel?: string;
  expectedPixelWidth?: number;
  expectedPixelHeight?: number;
  actualPixelWidth?: number;
  actualPixelHeight?: number;
  automatedIssues?: StepQaWarning[];
  qaFailed?: boolean;
};

type PublishValidationInput = {
  title: string;
  pageCount: number;
  expectedPageCount: number;
  savedStepCount: number;
  totalStepCount: number;
  pageTextCompleteness: number;
  hasBackCoverQrUrl: boolean;
  showBackCoverQr: boolean;
  showBackCoverLogo: boolean;
  showBackCoverSlogan: boolean;
  backCoverSlogan: string;
  printBleedInches: number;
  unresolvedQaCount: number;
  unresolvedQaBlockerCount: number;
  lockedSavedCount: number;
  hasFinalStory: boolean;
};

const containsAny = (value: string, needles: string[]) =>
  needles.some((needle) => value.includes(needle));

const mergeWarnings = (warnings: StepQaWarning[]) => {
  const merged = new Map<string, StepQaWarning>();
  for (const warning of warnings) {
    const existing = merged.get(warning.id);
    if (!existing) {
      merged.set(warning.id, warning);
      continue;
    }
    merged.set(warning.id, {
      ...existing,
      severity:
        existing.severity === "blocker" || warning.severity === "blocker"
          ? "blocker"
          : "warning",
      detail:
        warning.detail.length > existing.detail.length ? warning.detail : existing.detail,
    });
  }
  return [...merged.values()];
};

export const buildStepQaWarnings = (input: StepQaInput): StepQaWarning[] => {
  const prompt = input.prompt.toLowerCase();
  const story = input.storyText.toLowerCase();
  const warnings: StepQaWarning[] = [];

  const mirrorRisk = containsAny(prompt, ["mirror", "reflection"]) || containsAny(story, ["mirror", "reflection"]);
  if (mirrorRisk) {
    warnings.push({
      id: "mirror-review",
      label: "Mirror continuity",
      detail:
        "Check that every visible reflection matches exactly one real child with the right pose, clothing, spacing, and left-right reversal.",
      severity: "warning",
    });
  }

  const outdoorTrafficRisk = containsAny(prompt, [
    "road",
    "street",
    "traffic",
    "bus",
    "crosswalk",
    "sidewalk",
    "river path",
    "plaza",
  ]) || containsAny(story, ["road", "street", "traffic", "bus", "crosswalk"]);
  if (outdoorTrafficRisk) {
    warnings.push({
      id: "safe-staging",
      label: "Child-safe staging",
      detail:
        "Verify that children remain in a safe pedestrian space and are not dancing or stopping in an active roadway.",
      severity: "warning",
    });
  }

  const anatomyRisk =
    containsAny(prompt, ["dance", "bow", "practice", "mirror", "reflection"]) ||
    containsAny(story, ["dance", "bow", "practice", "mirror", "reflection"]);
  if (anatomyRisk) {
    warnings.push({
      id: "anatomy-check",
      label: "Anatomy and pose realism",
      detail:
        "Check body proportions, limb placement, and balance so the movement reads naturally for the same children across the book.",
      severity: "warning",
    });
  }

  const mockupRisk =
    containsAny(prompt, ["book mockup", "open-book", "page seam", "gutter", "spine"]) ||
    containsAny(story, ["speech bubble", "sign", "poster"]);
  if (mockupRisk || input.step.kind === "page") {
    warnings.push({
      id: "book-mockup",
      label: "Book and page artifacts",
      detail:
        "Check that the art is only the illustrated scene, with no page seams, open-book framing, borders, gutters, or printed-page artifacts.",
      severity: "warning",
    });
  }

  if (input.step.kind === "page") {
    warnings.push({
      id: "stray-text",
      label: "Stray text and speech bubbles",
      detail:
        "Check that the illustration has no readable text, speech bubbles, signage, or captions baked into the art.",
      severity: "warning",
    });
  }

  if (
    input.expectedPixelWidth &&
    input.expectedPixelHeight &&
    input.actualPixelWidth &&
    input.actualPixelHeight
  ) {
    const expectedRatio = input.expectedPixelWidth / input.expectedPixelHeight;
    const actualRatio = input.actualPixelWidth / input.actualPixelHeight;
    if (Number.isFinite(expectedRatio) && Number.isFinite(actualRatio)) {
      const ratioDelta = Math.abs(expectedRatio - actualRatio);
      if (ratioDelta > 0.03) {
        warnings.push({
          id: "aspect-composition",
          label: "Aspect and trim mismatch",
          detail: `The saved image geometry (${input.actualPixelWidth}×${input.actualPixelHeight}) drifts away from the expected ${input.expectedAspectRatioLabel ?? "page"} composition.`,
          severity: "blocker",
        });
      }
    }
  }

  if (input.sameCastRisk) {
    warnings.push({
      id: "character-distinction",
      label: "Character distinction",
      detail:
        "Verify that recurring children stay visually distinct and have not drifted into near-twins, clones, or swapped identities.",
      severity: "warning",
    });
  }

  if (input.qaFailed) {
    warnings.push({
      id: "qa-unavailable",
      label: "Automated QA unavailable",
      detail:
        "The automated image checker could not complete, so this image still needs a careful manual review before save or export.",
      severity: "warning",
    });
  }

  if (input.status === "generated") {
    warnings.push({
      id: "approve-before-save",
      label: "Approve before locking",
      detail:
        "This art is generated but not saved yet. Review it carefully before accepting and locking it into the story library.",
      severity: "warning",
    });
  }

  return mergeWarnings([...(input.automatedIssues ?? []), ...warnings]);
};

export const buildPublishValidation = (
  input: PublishValidationInput,
): PublishValidationResult => {
  const items: PublishChecklistItem[] = [];

  items.push({
    id: "final-story",
    label: "Final story is ready",
    detail: input.hasFinalStory
      ? `Final text is present with ${input.pageCount} page${input.pageCount === 1 ? "" : "s"}.`
      : "Generate the final story first so the layout and export steps have real page text.",
    status: input.hasFinalStory ? "pass" : "blocker",
  });

  items.push({
    id: "page-count",
    label: "Page count matches the story plan",
    detail:
      input.pageCount === input.expectedPageCount
        ? `${input.pageCount} of ${input.expectedPageCount} expected pages are present.`
        : `Expected ${input.expectedPageCount} pages but found ${input.pageCount}.`,
    status: input.pageCount === input.expectedPageCount ? "pass" : "blocker",
  });

  items.push({
    id: "saved-art",
    label: "All book art is saved",
    detail:
      input.savedStepCount === input.totalStepCount
        ? `${input.savedStepCount} of ${input.totalStepCount} sheets are saved.`
        : `${input.savedStepCount} of ${input.totalStepCount} sheets are saved. Accept and save the remaining art before export.`,
    status: input.savedStepCount === input.totalStepCount ? "pass" : "blocker",
  });

  items.push({
    id: "page-text",
    label: "Every page has final editable text",
    detail:
      input.pageTextCompleteness === input.expectedPageCount
        ? "Every story page has editable final text."
        : `${input.pageTextCompleteness} of ${input.expectedPageCount} pages have non-empty final text.`,
    status:
      input.pageTextCompleteness === input.expectedPageCount ? "pass" : "blocker",
  });

  items.push({
    id: "back-cover-branding",
    label: "Back cover branding is complete",
    detail:
      input.showBackCoverQr && !input.hasBackCoverQrUrl
        ? "Add a QR destination URL or turn the QR off before export."
        : input.showBackCoverSlogan && input.backCoverSlogan.trim().length === 0
          ? "Add a slogan or turn the slogan off before export."
          : !input.showBackCoverLogo && !input.showBackCoverSlogan && !input.showBackCoverQr
            ? "The back cover currently has no branding elements enabled."
            : "Back cover metadata is ready for export.",
    status:
      input.showBackCoverQr && !input.hasBackCoverQrUrl
        ? "blocker"
        : input.showBackCoverSlogan && input.backCoverSlogan.trim().length === 0
          ? "blocker"
          : !input.showBackCoverLogo && !input.showBackCoverSlogan && !input.showBackCoverQr
            ? "warning"
            : "pass",
  });

  items.push({
    id: "print-settings",
    label: "Print settings are valid",
    detail:
      input.printBleedInches >= 0 && input.printBleedInches <= 0.25
        ? `Bleed is set to ${input.printBleedInches.toFixed(3)} in.`
        : "Bleed must stay between 0 and 0.25 inches for the current export pipeline.",
    status:
      input.printBleedInches >= 0 && input.printBleedInches <= 0.25
        ? "pass"
        : "blocker",
  });

  items.push({
    id: "qa-review",
    label: "Image QA review is complete",
    detail:
      input.unresolvedQaCount === 0
        ? "All saved images have been reviewed against the QA checklist."
        : `${input.unresolvedQaCount} saved image${input.unresolvedQaCount === 1 ? "" : "s"} still need QA review.`,
    status: input.unresolvedQaCount === 0 ? "pass" : "warning",
  });

  items.push({
    id: "qa-blockers",
    label: "Critical image QA blockers are resolved",
    detail:
      input.unresolvedQaBlockerCount === 0
        ? "No saved sheets are still carrying unresolved blocker-level QA findings."
        : `${input.unresolvedQaBlockerCount} saved sheet${input.unresolvedQaBlockerCount === 1 ? "" : "s"} still have blocker-level QA findings that need review before export.`,
    status: input.unresolvedQaBlockerCount === 0 ? "pass" : "blocker",
  });

  items.push({
    id: "locked-art",
    label: "Approved art is locked",
    detail:
      input.lockedSavedCount === input.savedStepCount
        ? "All saved sheets are locked against accidental regeneration."
        : `${input.lockedSavedCount} of ${input.savedStepCount} saved sheets are locked.`,
    status: input.lockedSavedCount === input.savedStepCount ? "pass" : "warning",
  });

  const blockers = items.filter((item) => item.status === "blocker");
  const warnings = items.filter((item) => item.status === "warning");
  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    items,
  };
};
