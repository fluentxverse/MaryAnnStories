import { For, Show } from "solid-js";

export default function ImagesWorkspace(props: any) {
  return (
    <section class="image-workspace" role="tabpanel" aria-label="Image generation">
      <div class="panel image-panel">
        <div class="panel-header">
          <p class="panel-kicker">Images</p>
          <h2>Image queue</h2>
        </div>
        <div class="image-queue-header">
          <Show when={props.imageSteps().length > 0}>
            <>
              <div class="image-step-list">
                <For each={props.imageSteps()}>
                  {(step, index) => (
                    <button
                      class={`image-step-chip ${
                        index() === props.activeImageStepIndex() ? "active" : ""
                      } ${props.imageStepResults()[step.id]?.status ?? "idle"}`}
                      type="button"
                      onClick={() => {
                        props.setActiveImageStepIndex(index());
                        props.setImageError(null);
                        props.setAcceptError(null);
                      }}
                      disabled={!props.isImageStepUnlocked(index())}
                    >
                      <span>{step.label}</span>
                      <span class="image-step-status">
                        {(props.imageStepResults()[step.id]?.status ?? "idle") === "saved"
                          ? "Saved"
                          : (props.imageStepResults()[step.id]?.status ?? "idle") === "generated"
                            ? "Ready"
                            : "Queued"}
                      </span>
                    </button>
                  )}
                </For>
              </div>
              <div class="image-progress">
                <div class="image-progress-meta">
                  <span>
                    Covers {props.imageProgress().coverSaved}/{props.imageProgress().coverTotal}
                  </span>
                  <span>
                    {props.imageProgress().pagesTotal === 0
                      ? "Pages locked"
                      : `Pages ${props.imageProgress().pagesSaved}/${props.imageProgress().pagesTotal}`}
                  </span>
                  <span>
                    Total {props.imageProgress().totalSaved}/{props.imageProgress().total}
                  </span>
                </div>
                <div class="image-progress-bar">
                  <span
                    class="image-progress-fill"
                    style={{ width: `${props.imageProgress().percent}%` }}
                  />
                </div>
              </div>
            </>
          </Show>
          <Show when={!props.finalStory()}>
            <div class="panel-note panel-note-inline">
              The front cover can be generated now. Save it to unlock the back cover, then continue
              into the interior pages after the final story is ready.
            </div>
          </Show>
        </div>
        <div class="image-grid">
          <div class="image-controls">
            <div class="profile-grid">
              <For each={props.imageMetaCards()}>
                {(item) => (
                  <div class="profile-chip">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                )}
              </For>
            </div>

            <div class="prompt-editor-card">
              <div class="prompt-editor-header">
                <div>
                  <span class="detail-label">Image prompt</span>
                  <strong>{props.activeImageStep()?.label ?? "Current step"}</strong>
                </div>
                <Show
                  when={Boolean(
                    props.activeImageStep() &&
                      props.imageSettings().promptOverrides[props.activeImageStep()!.id] !==
                        undefined,
                  )}
                >
                  <button
                    class="button subtle"
                    type="button"
                    onClick={() => {
                      const step = props.activeImageStep();
                      if (!step) return;
                      props.resetImagePromptOverride(step.id, step.prompt);
                    }}
                  >
                    Reset prompt
                  </button>
                </Show>
              </div>
              <textarea
                class="image-prompt-textarea"
                value={props.activeImagePrompt()}
                placeholder="Run the final story to build prompts."
                rows={8}
                disabled={props.activeImageLocked() && props.activeImageResult()?.status === "saved"}
                onInput={(event) => {
                  const step = props.activeImageStep();
                  if (!step) return;
                  props.updateImagePromptOverride(step.id, event.currentTarget.value);
                }}
              />
              <p class="field-help">
                Edit this prompt before generating if you want to correct staging, reflections, or
                scene detail for the current page.
              </p>
            </div>

            <div class="form-actions image-actions-bar">
              <div class="image-actions-buttons">
                <Show
                  when={props.hasGeneratedImages()}
                  fallback={
                    <button
                      class="button primary"
                      type="button"
                      onClick={props.handleGenerateImages}
                      disabled={
                        props.isGeneratingImages() ||
                        (props.activeImageLocked() && props.activeImageResult()?.status === "saved")
                      }
                    >
                      {props.isGeneratingImages()
                        ? "Generating..."
                        : props.activeImageLocked() && props.activeImageResult()?.status === "saved"
                          ? "Unlock to regenerate"
                          : "Run images"}
                    </button>
                  }
                >
                  <button
                    class="button ghost"
                    type="button"
                    onClick={props.handleGenerateImages}
                    disabled={
                      props.isGeneratingImages() ||
                      (props.activeImageLocked() && props.activeImageResult()?.status === "saved")
                    }
                  >
                    {props.isGeneratingImages()
                      ? "Regenerating..."
                      : props.activeImageLocked() && props.activeImageResult()?.status === "saved"
                        ? "Unlock to regenerate"
                        : "Regenerate"}
                  </button>
                  <Show when={props.activeImageResult()?.status === "generated"}>
                    <button
                      class="button primary"
                      type="button"
                      onClick={props.handleAcceptImage}
                      disabled={!props.canAcceptActiveImage()}
                    >
                      {props.isAcceptingImage()
                        ? "Saving..."
                        : props.activeImageQaStatus() === "running"
                          ? "QA running..."
                          : props.activeImageNeedsQaBlockerReview()
                            ? "Review blockers first"
                            : "Accept & save"}
                    </button>
                  </Show>
                  <Show when={props.activeImageResult()?.status === "saved"}>
                    <span class="saved-pill">Saved</span>
                  </Show>
                </Show>
                <Show when={props.activeImageResult()?.status === "saved"}>
                  <button class="button subtle" type="button" onClick={props.toggleActiveImageLock}>
                    {props.activeImageLocked() ? "Unlock step" : "Lock step"}
                  </button>
                </Show>
                <button class="button ghost" type="button" onClick={props.requestResetImages}>
                  Reset images
                </button>
                <Show when={props.finalStory()}>
                  <button class="button ghost" type="button" onClick={() => props.setActiveTab("layout")}>
                    Open layout
                  </button>
                </Show>
              </div>

              <label class="image-model-picker">
                <span class="detail-label">Image model</span>
                <select
                  value={props.imageSettings().imageModel}
                  onInput={(event) => props.updateImageSetting("imageModel", event.currentTarget.value)}
                >
                  <For each={props.activeImageModelOptions()}>
                    {(option) => <option value={option.id}>{option.label}</option>}
                  </For>
                </select>
                <span class="field-help">
                  {props.activeImageModelOptions().find(
                    (option) => option.id === props.imageSettings().imageModel,
                  )?.note ?? props.activeImageModelLabel()}
                </span>
              </label>
            </div>

            <Show when={props.imageError()}>
              <div class="panel-note panel-note-inline">{props.imageError()}</div>
            </Show>

            <Show when={props.acceptError()}>
              <div class="panel-note panel-note-inline">{props.acceptError()}</div>
            </Show>

            <Show when={props.lastImagesGeneratedAt()}>
              <div class="generated-banner">Images generated at {props.lastImagesGeneratedAt()}.</div>
            </Show>

            <Show when={props.activeImageResult()?.status === "saved"}>
              <div class="generated-banner">Image saved to story library.</div>
            </Show>

            <div class="production-card image-qa-card">
              <div class="prompt-editor-header">
                <div>
                  <span class="detail-label">Image QA</span>
                  <strong>
                    {props.activeImageQaStatus() === "running"
                      ? "Analyzing"
                      : props.activeImageQaReviewed()
                        ? "Reviewed"
                        : props.activeImageQaReport()?.issues.length
                          ? "Needs review"
                          : props.activeImageQaStatus() === "complete"
                            ? "Clean pass"
                            : "Needs review"}
                  </strong>
                </div>
                <button
                  class="button subtle"
                  type="button"
                  onClick={props.markActiveImageQaReviewed}
                  disabled={!props.activeImageStep()}
                >
                  Mark reviewed
                </button>
              </div>
              <Show when={props.activeImageQaStatus() === "running"}>
                <div class="panel-note panel-note-inline">
                  We are checking the generated art for readable text, safety, reflections,
                  character drift, anatomy, and book/mockup artifacts.
                </div>
              </Show>
              <Show when={props.activeImageQaReport()?.summary}>
                <div class="panel-note panel-note-inline">{props.activeImageQaReport()!.summary}</div>
              </Show>
              <Show when={props.activeImageResult()?.qaError}>
                <div class="panel-note panel-note-inline">
                  Automated QA is unavailable right now. You can still review the image manually
                  before saving or exporting.
                </div>
              </Show>
              <Show
                when={props.activeImageQaWarnings().length > 0}
                fallback={
                  <div class="panel-note panel-note-inline">
                    This step does not have any special QA reminders right now.
                  </div>
                }
              >
                <ul class="publish-checklist image-qa-list">
                  <For each={props.activeImageQaWarnings()}>
                    {(warning) => (
                      <li class={`publish-checklist-item ${warning.severity}`}>
                        <div>
                          <strong>{warning.label}</strong>
                          <p>{warning.detail}</p>
                        </div>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
              <Show when={props.activeImageNeedsQaBlockerReview()}>
                <div class="panel-note panel-note-inline">
                  Review the blocker-level QA findings and mark this step reviewed before you save
                  it into the story library.
                </div>
              </Show>
              <label class="field">
                {props.renderFieldLabel("Review notes", false)}
                <textarea
                  rows={3}
                  value={props.activeImageQaReviewNote()}
                  placeholder="Optional notes about reflections, text, safety, or character drift."
                  onInput={(event) => {
                    const step = props.activeImageStep();
                    if (!step) return;
                    props.updateImageQaReviewNote(step.id, event.currentTarget.value);
                  }}
                />
              </label>
            </div>

            <div class="production-card image-history-card">
              <div class="prompt-editor-header">
                <div>
                  <span class="detail-label">Version history</span>
                  <strong>{props.activeImageHistory().length} saved attempts</strong>
                </div>
              </div>
              <Show
                when={props.activeImageHistory().length > 0}
                fallback={
                  <div class="panel-note panel-note-inline">
                    Generated and accepted versions will appear here so you can restore older
                    attempts.
                  </div>
                }
              >
                <div class="image-history-list">
                  <For each={props.activeImageHistory()}>
                    {(entry) => (
                      <div class="image-history-item">
                        <div>
                          <strong>
                            {entry.status === "saved" ? "Accepted version" : "Generated version"}
                          </strong>
                          <p class="subtle-text">
                            {props.formatTimestamp(entry.createdAt)} • {entry.prompt.slice(0, 90)}
                            {entry.prompt.length > 90 ? "..." : ""}
                          </p>
                        </div>
                        <button
                          class="button subtle"
                          type="button"
                          onClick={() => props.restoreImageVersion(entry)}
                        >
                          Restore
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </div>

          <div class="image-preview">
            <Show
              when={props.activeImageUrl()}
              fallback={
                <div class="image-placeholder">
                  <p class="detail-label">Preview</p>
                  <p class="subtle-text">
                    Run the current image step to see the generated art. Once images are ready,
                    click the preview to open the full gallery.
                  </p>
                </div>
              }
            >
              <button class="image-frame image-frame-button" type="button" onClick={props.openGeneratedModal}>
                <div class="image-art-stage">
                  <img
                    src={props.activeImageUrl()!}
                    alt={props.activeImageStep()?.label ?? "Generated story art"}
                  />
                  <Show when={props.showBackCoverPreviewImprint()}>
                    {props.renderBackCoverImprint("preview")}
                  </Show>
                </div>
              </button>
            </Show>
          </div>
        </div>
      </div>
    </section>
  );
}
