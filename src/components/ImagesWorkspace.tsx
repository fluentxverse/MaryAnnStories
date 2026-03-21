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
                    src={props.activeImagePreviewUrl?.() ?? props.activeImageUrl()!}
                    data-fullsrc={props.activeImageUrl?.() ?? ""}
                    alt={props.activeImageStep()?.label ?? "Generated story art"}
                    loading="eager"
                    decoding="async"
                    fetchpriority="high"
                    onError={(event) => {
                      const fallback = event.currentTarget.dataset.fullsrc;
                      if (fallback && event.currentTarget.src !== fallback) {
                        event.currentTarget.src = fallback;
                      }
                    }}
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
