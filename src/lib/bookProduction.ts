export type ProductionStepKind = "cover" | "back_cover" | "page";

export type ProductionImageStatus = "idle" | "generated" | "saved";

export type ProductionStep = {
  id: string;
  label: string;
  kind: ProductionStepKind;
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
  lockedSavedCount: number;
  hasFinalStory: boolean;
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
