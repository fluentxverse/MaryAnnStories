import { describe, expect, it } from "vitest";

import { buildPublishValidation } from "./bookProduction";

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
      lockedSavedCount: 12,
      hasFinalStory: true,
    });

    expect(result.ready).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

});
