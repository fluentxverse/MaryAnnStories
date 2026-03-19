import { describe, expect, it } from "vitest";

import { buildPublishValidation, buildStepQaWarnings } from "./bookProduction";

describe("buildStepQaWarnings", () => {
  it("adds targeted warnings for mirrors, safety, and character distinction", () => {
    const warnings = buildStepQaWarnings({
      step: { id: "page-3", label: "Page 3", kind: "page" },
      prompt: "Keep the mirror accurate while the children practice near a busy street.",
      storyText: "They look at the mirror and hear a bus outside.",
      status: "generated",
      sameCastRisk: true,
    });

    expect(warnings.map((warning) => warning.id)).toEqual(
      expect.arrayContaining([
        "mirror-review",
        "safe-staging",
        "stray-text",
        "character-distinction",
        "approve-before-save",
      ]),
    );
  });
});

describe("buildPublishValidation", () => {
  it("blocks publish readiness when required data is missing", () => {
    const result = buildPublishValidation({
      title: "Golden Steps in Seoul",
      pageCount: 9,
      expectedPageCount: 10,
      savedStepCount: 8,
      totalStepCount: 12,
      pageTextCompleteness: 9,
      hasBackCoverQrUrl: false,
      showBackCoverQr: true,
      showBackCoverLogo: true,
      showBackCoverSlogan: true,
      backCoverSlogan: "Gentle storybooks for growing hearts",
      printBleedInches: 0.125,
      unresolvedQaCount: 2,
      unresolvedQaBlockerCount: 1,
      lockedSavedCount: 3,
      hasFinalStory: true,
    });

    expect(result.ready).toBe(false);
    expect(result.blockers.map((item) => item.id)).toEqual(
      expect.arrayContaining(["page-count", "saved-art", "page-text", "back-cover-branding"]),
    );
  });

  it("marks the book ready when all publish checks pass", () => {
    const result = buildPublishValidation({
      title: "Golden Steps in Seoul",
      pageCount: 10,
      expectedPageCount: 10,
      savedStepCount: 12,
      totalStepCount: 12,
      pageTextCompleteness: 10,
      hasBackCoverQrUrl: true,
      showBackCoverQr: true,
      showBackCoverLogo: true,
      showBackCoverSlogan: true,
      backCoverSlogan: "Gentle storybooks for growing hearts",
      printBleedInches: 0.125,
      unresolvedQaCount: 0,
      unresolvedQaBlockerCount: 0,
      lockedSavedCount: 12,
      hasFinalStory: true,
    });

    expect(result.ready).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it("blocks publish readiness when automated QA blockers remain unresolved", () => {
    const result = buildPublishValidation({
      title: "Golden Steps in Seoul",
      pageCount: 10,
      expectedPageCount: 10,
      savedStepCount: 12,
      totalStepCount: 12,
      pageTextCompleteness: 10,
      hasBackCoverQrUrl: true,
      showBackCoverQr: true,
      showBackCoverLogo: true,
      showBackCoverSlogan: true,
      backCoverSlogan: "Gentle storybooks for growing hearts",
      printBleedInches: 0.125,
      unresolvedQaCount: 1,
      unresolvedQaBlockerCount: 1,
      lockedSavedCount: 12,
      hasFinalStory: true,
    });

    expect(result.ready).toBe(false);
    expect(result.blockers.map((item) => item.id)).toContain("qa-blockers");
  });
});

describe("buildStepQaWarnings geometry checks", () => {
  it("raises a blocker when the saved image geometry drifts from the expected trim", () => {
    const warnings = buildStepQaWarnings({
      step: { id: "page-9", label: "Page 9", kind: "page" },
      prompt: "Render one clean wide full-bleed illustration.",
      storyText: "They finish the dance with a bow.",
      status: "saved",
      sameCastRisk: false,
      expectedAspectRatioLabel: "8:5 spread",
      expectedPixelWidth: 2458,
      expectedPixelHeight: 1536,
      actualPixelWidth: 2048,
      actualPixelHeight: 1536,
    });

    const aspectWarning = warnings.find((warning) => warning.id === "aspect-composition");
    expect(aspectWarning?.severity).toBe("blocker");
  });
});
