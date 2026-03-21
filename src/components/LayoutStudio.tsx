import { For, Show } from "solid-js";

export default function LayoutStudio(props: any) {
  return (
    <section class="layout-studio" role="tabpanel" aria-label="Book layout preview">
      <div class="panel layout-studio-panel">
        <div class="panel-header">
          <p class="panel-kicker">Book layout</p>
          <h2>Storybook preview</h2>
          <p class="subtle-text">
            Pair the current page text with the approved illustration and tune the reading surface
            before we think about export. Each page now keeps its own text layout choices.
          </p>
        </div>

        <Show
          when={props.finalStory()}
          fallback={
            props.finalError() ? (
              <div class="panel-note panel-note-inline">{props.finalError()}</div>
            ) : (
              <div class="panel-note panel-note-inline">
                Run the final story first, then save page art in Images so we can compose the
                picture-book layout here.
              </div>
            )
          }
        >
          <div class="layout-toolbar">
            <div class="final-story-nav">
              <button
                class="final-nav-button"
                type="button"
                onClick={() => props.setFinalPageIndex((current: number) => Math.max(0, current - 1))}
                disabled={props.finalPageIndex() === 0}
                aria-label="Previous layout page"
              >
                ◀
              </button>
              <span class="final-page-indicator">
                Page {props.finalPageIndex() + 1} of {props.finalStory()!.pages.length}
              </span>
              <button
                class="final-nav-button"
                type="button"
                onClick={() =>
                  props.setFinalPageIndex((current: number) =>
                    Math.min(props.finalStory()!.pages.length - 1, current + 1),
                  )
                }
                disabled={props.finalPageIndex() >= props.finalStory()!.pages.length - 1}
                aria-label="Next layout page"
              >
                ▶
              </button>
            </div>

            <div class="layout-toolbar-actions">
              <button class="button ghost" type="button" onClick={() => props.setActiveTab("images")}>
                Back to images
              </button>
            </div>
          </div>

          <div class="layout-studio-grid">
            <div class="layout-controls-stack">
              <div class={`layout-status-card ${props.activeLayoutStatusMeta().tone}`}>
                <span class="detail-label">Current page art</span>
                <strong>{props.activeLayoutStatusMeta().label}</strong>
                <p class="field-help">{props.activeLayoutStatusMeta().note}</p>
              </div>

              <div class="layout-control-grid">
                <label class="field">
                  {props.renderFieldLabel("Text width", false)}
                  <select
                    value={props.activeLayoutSettings().bookLayoutTextWidth}
                    onInput={(event) => {
                      const width = event.currentTarget.value;
                      props.updateActivePageLayoutSettings({
                        bookLayoutTextWidth: width,
                        bookLayoutTextPosition: props.getDefaultTextPositionForWidth(width),
                        bookLayoutHorizontalOffset: 0,
                      });
                    }}
                  >
                    <For each={props.bookLayoutTextWidthOptions}>
                      {(option) => <option value={option.id}>{option.label}</option>}
                    </For>
                  </select>
                  <span class="field-help">{props.activeLayoutTextWidth().note}</span>
                </label>

                <label class="field">
                  {props.renderFieldLabel("Text position", false)}
                  <select
                    value={props.activeLayoutSettings().bookLayoutTextPosition}
                    onInput={(event) =>
                      props.updateActivePageLayoutSettings({
                        bookLayoutTextPosition: event.currentTarget.value,
                      })
                    }
                  >
                    <For each={props.activeLayoutPositionOptions()}>
                      {(option) => <option value={option.id}>{option.label}</option>}
                    </For>
                  </select>
                  <span class="field-help">{props.activeLayoutPositionNote()}</span>
                </label>
              </div>

              <div class="layout-control-grid">
                <label class="field">
                  {props.renderFieldLabel("Text surface", false)}
                  <select
                    value={props.activeLayoutSettings().bookLayoutTextSurface}
                    onInput={(event) =>
                      props.updateActivePageLayoutSettings({
                        bookLayoutTextSurface: event.currentTarget.value,
                      })
                    }
                  >
                    <For each={props.bookLayoutTextSurfaceOptions}>
                      {(option) => <option value={option.id}>{option.label}</option>}
                    </For>
                  </select>
                  <span class="field-help">{props.activeLayoutTextSurface().note}</span>
                </label>

                <label class="field">
                  {props.renderFieldLabel("Font style", false)}
                  <select
                    value={props.activeLayoutSettings().bookLayoutFont}
                    onInput={(event) =>
                      props.updateActivePageLayoutSettings({
                        bookLayoutFont: event.currentTarget.value,
                      })
                    }
                  >
                    <For each={props.bookLayoutFontOptions}>
                      {(option) => <option value={option.id}>{option.label}</option>}
                    </For>
                  </select>
                  <span class="field-help">{props.activeLayoutFont().note}</span>
                </label>
              </div>

              <div class="layout-control-grid single">
                <label class="field">
                  {props.renderFieldLabel("Font weight", false)}
                  <select
                    value={props.activeLayoutSettings().bookLayoutFontWeight}
                    onInput={(event) =>
                      props.updateActivePageLayoutSettings({
                        bookLayoutFontWeight: event.currentTarget.value,
                      })
                    }
                  >
                    <For each={props.bookLayoutFontWeightOptions}>
                      {(option) => <option value={option.id}>{option.label}</option>}
                    </For>
                  </select>
                  <span class="field-help">{props.activeLayoutFontWeight().note}</span>
                </label>
              </div>

              <div class="layout-control-grid compact">
                <label class="reader-slider layout-slider">
                  <span>Font size</span>
                  <input
                    type="range"
                    min="0.85"
                    max="1.45"
                    step="0.05"
                    value={props.activeLayoutSettings().bookLayoutFontScale}
                    onInput={(event) =>
                      props.updateActivePageLayoutSettings({
                        bookLayoutFontScale: parseFloat(event.currentTarget.value),
                      })
                    }
                  />
                  <strong>{props.activeLayoutSettings().bookLayoutFontScale.toFixed(2)}x</strong>
                </label>

                <Show when={props.activeLayoutSettings().bookLayoutTextWidth === "third"}>
                  <label class="reader-slider layout-slider">
                    <span>Horizontal nudge</span>
                    <input
                      type="range"
                      min="-18"
                      max="18"
                      step="1"
                      value={props.activeLayoutSettings().bookLayoutHorizontalOffset}
                      onInput={(event) =>
                        props.updateActivePageLayoutSettings({
                          bookLayoutHorizontalOffset: parseFloat(event.currentTarget.value),
                        })
                      }
                    />
                    <strong>
                      {props.activeLayoutSettings().bookLayoutHorizontalOffset > 0 ? "+" : ""}
                      {props.activeLayoutSettings().bookLayoutHorizontalOffset}%
                    </strong>
                  </label>
                </Show>

                <label class="reader-toggle">
                  <input
                    type="checkbox"
                    checked={props.readAloudMode()}
                    onInput={(event) => props.setReadAloudMode(event.currentTarget.checked)}
                  />
                  <span>Read-aloud spacing</span>
                </label>
              </div>

              <div class="layout-meta-grid">
                <div class="profile-chip">
                  <span>Spread size</span>
                  <strong>{props.activeLayoutGeometry().trimLabel}</strong>
                </div>
                <div class="profile-chip">
                  <span>Preview ratio</span>
                  <strong>{props.activeLayoutGeometry().aspectRatioLabel}</strong>
                </div>
                <div class="profile-chip">
                  <span>Image source</span>
                  <strong>
                    {props.activeLayoutResult()?.status === "saved"
                      ? "Accepted art"
                      : props.activeLayoutResult()?.status === "generated"
                        ? "Generated art"
                        : "Waiting on art"}
                  </strong>
                </div>
              </div>
            </div>

            <div class="layout-preview-panel">
              <div class="layout-preview-header">
                <div>
                  <span class="detail-label">Preview spread</span>
                  <strong>{props.activeLayoutStep()?.label ?? `Page ${props.finalPageIndex() + 1}`}</strong>
                </div>
                <p class="subtle-text">
                  Text stays inside safe margins so this reads like a real picture-book page.
                </p>
              </div>

              <div
                class={`book-layout-canvas ${
                  props.imageSettings().printShowSafeZone ? "show-safe-zone" : ""
                } text-width-${props.activeLayoutSettings().bookLayoutTextWidth} text-position-${
                  props.activeLayoutSettings().bookLayoutTextPosition
                } text-surface-${props.activeLayoutSettings().bookLayoutTextSurface} ${
                  props.activeLayoutImageUrl() ? "has-art" : "empty"
                }`}
                style={{
                  "--layout-font-scale": String(props.activeLayoutSettings().bookLayoutFontScale),
                  "--layout-line-height": props.readAloudMode() ? "1.95" : "1.68",
                  "--layout-font-family": props.activeLayoutFont().family,
                  "--layout-font-weight": String(props.activeLayoutFontWeight().weight),
                  "--layout-offset-x": String(
                    props.activeLayoutSettings().bookLayoutTextWidth === "third"
                      ? props.activeLayoutSettings().bookLayoutHorizontalOffset
                      : 0,
                  ),
                  "aspect-ratio": `${props.activeLayoutGeometry().width} / ${props.activeLayoutGeometry().height}`,
                }}
              >
                <div class="book-layout-art-layer">
                  <Show
                    when={props.activeLayoutImageUrl()}
                    fallback={
                      <div class="book-layout-art-placeholder">
                        <span class="detail-label">Waiting on page art</span>
                        <p>
                          Save the current page image in Images and it will appear here as the
                          background.
                        </p>
                      </div>
                    }
                  >
                    <img
                      src={props.activeLayoutImageUrl()!}
                      data-fullsrc={props.activeLayoutFullImageUrl?.() ?? ""}
                      alt={`Storybook art for page ${props.finalPageIndex() + 1}`}
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
                  </Show>
                </div>
                <Show when={props.imageSettings().printShowSafeZone}>
                  <div class="book-layout-safe-guide" aria-hidden="true" />
                </Show>
                <div class="book-layout-safe-area">
                  <div class="book-layout-text-card">
                    <p class="book-layout-copy">{props.activeLayoutPageText()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="layout-production-grid">
            <div class="production-card">
              <div class="panel-header compact">
                <p class="panel-kicker">Final text editor</p>
                <h3>Polish this page’s copy</h3>
                <p class="subtle-text">
                  Editing here updates only the current page and flows straight into export.
                </p>
              </div>
              <label class="field">
                {props.renderFieldLabel(`Page ${props.finalPageIndex() + 1} text`, true)}
                <textarea
                  class="page-copy-editor"
                  rows={8}
                  value={props.activeLayoutPageText()}
                  onInput={(event) =>
                    props.updateFinalStoryPageText(props.finalPageIndex(), event.currentTarget.value)
                  }
                />
                <span class="field-help">
                  This is the exact page text used by the emulator, print PDF, and print package.
                </span>
              </label>
            </div>

            <div class="production-card">
              <div class="panel-header compact">
                <p class="panel-kicker">Back cover editor</p>
                <h3>Printed metadata</h3>
                <p class="subtle-text">
                  Tune the logo, slogan, age band, QR, and optional publishing metadata without
                  repainting the art.
                </p>
              </div>

              <div class="layout-control-grid">
                <label class="field">
                  {props.renderFieldLabel("Slogan", false)}
                  <input
                    type="text"
                    value={props.imageSettings().backCoverSlogan}
                    onInput={(event) =>
                      props.updateImageSetting("backCoverSlogan", event.currentTarget.value)
                    }
                  />
                </label>

                <label class="field">
                  {props.renderFieldLabel("Age band override", false)}
                  <input
                    type="text"
                    value={props.imageSettings().backCoverAgeBand}
                    placeholder={props.builder().ageBand}
                    onInput={(event) =>
                      props.updateImageSetting("backCoverAgeBand", event.currentTarget.value)
                    }
                  />
                </label>
              </div>

              <div class="layout-control-grid">
                <label class="field">
                  {props.renderFieldLabel("Tagline", false)}
                  <input
                    type="text"
                    value={props.imageSettings().backCoverTagline}
                    placeholder="Optional short imprint line"
                    onInput={(event) =>
                      props.updateImageSetting("backCoverTagline", event.currentTarget.value)
                    }
                  />
                </label>

                <label class="field">
                  {props.renderFieldLabel("QR destination URL", false)}
                  <input
                    type="url"
                    value={props.imageSettings().backCoverQrUrl}
                    placeholder={props.resolvedBackCoverQrUrl() || "https://example.com/book"}
                    onInput={(event) =>
                      props.updateImageSetting("backCoverQrUrl", event.currentTarget.value)
                    }
                  />
                  <span class="field-help">
                    Leave blank to use the current story layout URL automatically.
                  </span>
                </label>
              </div>

              <div class="layout-control-grid">
                <label class="reader-slider layout-slider">
                  <span>Logo size</span>
                  <input
                    type="range"
                    min="0.65"
                    max="1.9"
                    step="0.05"
                    value={props.imageSettings().backCoverLogoScale}
                    onInput={(event) =>
                      props.updateImageSetting(
                        "backCoverLogoScale",
                        parseFloat(event.currentTarget.value),
                      )
                    }
                  />
                  <strong>{props.imageSettings().backCoverLogoScale.toFixed(2)}x</strong>
                </label>

                <label class="reader-slider layout-slider">
                  <span>Age band size</span>
                  <input
                    type="range"
                    min="0.65"
                    max="1.9"
                    step="0.05"
                    value={props.imageSettings().backCoverAgeBandScale}
                    onInput={(event) =>
                      props.updateImageSetting(
                        "backCoverAgeBandScale",
                        parseFloat(event.currentTarget.value),
                      )
                    }
                  />
                  <strong>{props.imageSettings().backCoverAgeBandScale.toFixed(2)}x</strong>
                </label>
              </div>

              <div class="layout-control-grid">
                <label class="reader-slider layout-slider">
                  <span>QR size</span>
                  <input
                    type="range"
                    min="0.65"
                    max="1.9"
                    step="0.05"
                    value={props.imageSettings().backCoverQrScale}
                    onInput={(event) =>
                      props.updateImageSetting(
                        "backCoverQrScale",
                        parseFloat(event.currentTarget.value),
                      )
                    }
                  />
                  <strong>{props.imageSettings().backCoverQrScale.toFixed(2)}x</strong>
                </label>

                <label class="reader-slider layout-slider">
                  <span>Horizontal position</span>
                  <input
                    type="range"
                    min="-24"
                    max="24"
                    step="1"
                    value={props.imageSettings().backCoverOffsetX}
                    onInput={(event) =>
                      props.updateImageSetting(
                        "backCoverOffsetX",
                        parseFloat(event.currentTarget.value),
                      )
                    }
                  />
                  <strong>
                    {props.imageSettings().backCoverOffsetX > 0 ? "+" : ""}
                    {props.imageSettings().backCoverOffsetX}%
                  </strong>
                </label>
              </div>

              <div class="layout-control-grid single">
                <label class="reader-slider layout-slider">
                  <span>Vertical position</span>
                  <input
                    type="range"
                    min="-12"
                    max="28"
                    step="1"
                    value={props.imageSettings().backCoverOffsetY}
                    onInput={(event) =>
                      props.updateImageSetting(
                        "backCoverOffsetY",
                        parseFloat(event.currentTarget.value),
                      )
                    }
                  />
                  <strong>
                    {props.imageSettings().backCoverOffsetY > 0 ? "+" : ""}
                    {props.imageSettings().backCoverOffsetY}%
                  </strong>
                </label>
              </div>

              <label class="field">
                {props.renderFieldLabel("Back cover blurb", false)}
                <textarea
                  rows={4}
                  value={props.imageSettings().backCoverBlurb}
                  placeholder="Optional back-cover blurb"
                  onInput={(event) =>
                    props.updateImageSetting("backCoverBlurb", event.currentTarget.value)
                  }
                />
              </label>

              <label class="field">
                {props.renderFieldLabel("Barcode / ISBN text", false)}
                <input
                  type="text"
                  value={props.imageSettings().backCoverBarcodeText}
                  placeholder="ISBN 978-0-000000-00-0"
                  onInput={(event) =>
                    props.updateImageSetting("backCoverBarcodeText", event.currentTarget.value)
                  }
                />
              </label>

              <div class="toggle-grid">
                <label class="reader-toggle">
                  <input
                    type="checkbox"
                    checked={props.imageSettings().backCoverShowLogo}
                    onInput={(event) =>
                      props.updateImageSetting("backCoverShowLogo", event.currentTarget.checked)
                    }
                  />
                  <span>Show logo</span>
                </label>
                <label class="reader-toggle">
                  <input
                    type="checkbox"
                    checked={props.imageSettings().backCoverShowSlogan}
                    onInput={(event) =>
                      props.updateImageSetting("backCoverShowSlogan", event.currentTarget.checked)
                    }
                  />
                  <span>Show slogan</span>
                </label>
                <label class="reader-toggle">
                  <input
                    type="checkbox"
                    checked={props.imageSettings().backCoverShowTagline}
                    onInput={(event) =>
                      props.updateImageSetting("backCoverShowTagline", event.currentTarget.checked)
                    }
                  />
                  <span>Show tagline</span>
                </label>
                <label class="reader-toggle">
                  <input
                    type="checkbox"
                    checked={props.imageSettings().backCoverShowBlurb}
                    onInput={(event) =>
                      props.updateImageSetting("backCoverShowBlurb", event.currentTarget.checked)
                    }
                  />
                  <span>Show blurb</span>
                </label>
                <label class="reader-toggle">
                  <input
                    type="checkbox"
                    checked={props.imageSettings().backCoverShowAgeBand}
                    onInput={(event) =>
                      props.updateImageSetting("backCoverShowAgeBand", event.currentTarget.checked)
                    }
                  />
                  <span>Show age band</span>
                </label>
                <label class="reader-toggle">
                  <input
                    type="checkbox"
                    checked={props.imageSettings().backCoverShowQr}
                    onInput={(event) =>
                      props.updateImageSetting("backCoverShowQr", event.currentTarget.checked)
                    }
                  />
                  <span>Show QR</span>
                </label>
                <label class="reader-toggle">
                  <input
                    type="checkbox"
                    checked={props.imageSettings().backCoverShowBarcode}
                    onInput={(event) =>
                      props.updateImageSetting("backCoverShowBarcode", event.currentTarget.checked)
                    }
                  />
                  <span>Show barcode placeholder</span>
                </label>
              </div>
            </div>

            <div class="production-card">
              <div class="panel-header compact">
                <p class="panel-kicker">Publish checklist</p>
                <h3>Ready to publish</h3>
                <p class="subtle-text">
                  This validation pass catches missing export metadata before the final export
                  before files go out.
                </p>
              </div>
              <div class="publish-summary-row">
                <div class="profile-chip">
                  <span>Status</span>
                  <strong>{props.publishValidation().ready ? "Ready" : "Needs work"}</strong>
                </div>
                <div class="profile-chip">
                  <span>Blockers</span>
                  <strong>{props.publishValidation().blockers.length}</strong>
                </div>
                <div class="profile-chip">
                  <span>Warnings</span>
                  <strong>{props.publishValidation().warnings.length}</strong>
                </div>
              </div>
              <ul class="publish-checklist">
                <For each={props.publishValidation().items}>
                  {(item) => (
                    <li class={`publish-checklist-item ${item.status}`}>
                      <div>
                        <strong>{item.label}</strong>
                        <p>{item.detail}</p>
                      </div>
                      <span class="publish-checklist-badge">
                        {item.status === "pass" ? "Pass" : item.status === "warning" ? "Warning" : "Blocker"}
                      </span>
                    </li>
                  )}
                </For>
              </ul>
            </div>

            <div class="production-card print-export-card">
              <div class="panel-header compact">
                <p class="panel-kicker">Print export</p>
                <h3>Printer-focused output</h3>
                <p class="subtle-text">
                  These settings feed both the print PDF and the zipped print package.
                </p>
              </div>

              <div class="print-export-settings">
                <label class="field">
                  {props.renderFieldLabel("Bleed (inches)", false)}
                  <input
                    type="number"
                    min="0"
                    max="0.25"
                    step="0.025"
                    value={props.imageSettings().printBleedInches}
                    onInput={(event) =>
                      props.updateImageSetting(
                        "printBleedInches",
                        props.clampNumber(Number.parseFloat(event.currentTarget.value) || 0, 0, 0.25),
                      )
                    }
                  />
                </label>

                <div class="print-export-toggle-row">
                  <label class="reader-toggle print-toggle">
                    <input
                      type="checkbox"
                      checked={props.imageSettings().printShowTrimMarks}
                      onInput={(event) =>
                        props.updateImageSetting("printShowTrimMarks", event.currentTarget.checked)
                      }
                    />
                    <span>Show trim marks</span>
                  </label>
                  <label class="reader-toggle print-toggle">
                    <input
                      type="checkbox"
                      checked={props.imageSettings().printShowSafeZone}
                      onInput={(event) =>
                        props.updateImageSetting("printShowSafeZone", event.currentTarget.checked)
                      }
                    />
                    <span>Show safe-zone guides</span>
                  </label>
                </div>
              </div>

              <div class="form-actions production-export-actions">
                <button
                  class="button primary compact"
                  type="button"
                  onClick={props.handleExportPdf}
                  disabled={props.isExportingPdf() || props.bookEmulatorSheets().length === 0}
                >
                  {props.isExportingPdf() ? "Exporting PDF..." : "Export print PDF"}
                </button>
                <button
                  class="button ghost compact"
                  type="button"
                  onClick={props.handleExportPrintPackage}
                  disabled={
                    props.isExportingPrintPackage() || props.bookEmulatorSheets().length === 0
                  }
                >
                  {props.isExportingPrintPackage() ? "Packaging..." : "Export print package"}
                </button>
              </div>
              <Show when={props.exportPdfError()}>
                <div class="panel-note panel-note-inline">{props.exportPdfError()}</div>
              </Show>
              <Show when={props.exportPackageError()}>
                <div class="panel-note panel-note-inline">{props.exportPackageError()}</div>
              </Show>
            </div>
          </div>

          <div class="book-emulator-panel">
            <div class="book-emulator-header">
              <div>
                <p class="panel-kicker">Book emulator</p>
                <h3>Flip through the full book</h3>
                <p class="subtle-text">
                  Covers and interior spreads stay true to the current trim size, spread mode, and
                  saved page layout settings.
                </p>
              </div>
              <div class="book-emulator-summary">
                <div class="profile-chip">
                  <span>Book flow</span>
                  <strong>{props.bookEmulatorActiveSheet()?.subtitle ?? "Waiting on book"}</strong>
                </div>
                <div class="profile-chip">
                  <span>Source</span>
                  <strong>{props.bookEmulatorStatusMeta().source}</strong>
                </div>
                <div class="profile-chip">
                  <span>Geometry</span>
                  <strong>
                    {props.bookEmulatorActiveSheet()?.geometry.trimLabel ??
                      props.activeLayoutGeometry().trimLabel}
                  </strong>
                </div>
              </div>
            </div>

            <div class="book-emulator-toolbar">
              <div class="final-story-nav">
                <button
                  class="final-nav-button"
                  type="button"
                  onClick={props.goBookEmulatorPrev}
                  disabled={props.bookEmulatorIndex() === 0}
                  aria-label="Previous book page"
                >
                  ◀
                </button>
                <span class="final-page-indicator">
                  {props.bookEmulatorActiveSheet()?.subtitle ?? "Book preview"} •{" "}
                  {props.bookEmulatorSheets().length === 0
                    ? "0 of 0"
                    : `${props.bookEmulatorIndex() + 1} of ${props.bookEmulatorSheets().length}`}
                </span>
                <button
                  class="final-nav-button"
                  type="button"
                  onClick={props.goBookEmulatorNext}
                  disabled={props.bookEmulatorIndex() >= props.bookEmulatorSheets().length - 1}
                  aria-label="Next book page"
                >
                  ▶
                </button>
              </div>
              <div class="book-emulator-toolbar-actions">
                <p class="subtle-text">{props.bookEmulatorStatusMeta().note}</p>
                <label class="inline-select">
                  <span class="detail-label">Jump to</span>
                  <select
                    value={String(props.bookEmulatorIndex())}
                    onInput={(event) =>
                      props.goBookEmulatorToIndex(Number.parseInt(event.currentTarget.value, 10) || 0)
                    }
                  >
                    <For each={props.bookEmulatorSheets()}>
                      {(sheet, index) => (
                        <option value={String(index())}>{sheet.subtitle}</option>
                      )}
                    </For>
                  </select>
                </label>
                <button
                  class="button ghost"
                  type="button"
                  onClick={props.toggleBookEmulatorFullscreen}
                  disabled={props.bookEmulatorSheets().length === 0}
                >
                  {props.isBookEmulatorFullscreen() ? "Exit fullscreen" : "Fullscreen"}
                </button>
              </div>
            </div>

            <div class="book-emulator-stage" ref={props.bookEmulatorStageRef}>
              <button
                class="book-emulator-click-zone left"
                type="button"
                onClick={props.goBookEmulatorPrev}
                disabled={props.bookEmulatorIndex() === 0}
                aria-label="Flip to previous page"
              />
              <button
                class="book-emulator-click-zone right"
                type="button"
                onClick={props.goBookEmulatorNext}
                disabled={props.bookEmulatorIndex() >= props.bookEmulatorSheets().length - 1}
                aria-label="Flip to next page"
              />
              <Show when={props.bookEmulatorActiveSheet()} keyed>
                {(sheet) => props.renderBookEmulatorSheet(sheet)}
              </Show>
            </div>
            <div class="book-emulator-thumbnails">
              <For each={props.bookEmulatorSheets()}>
                {(sheet, index) => (
                  <button
                    class={`book-emulator-thumbnail ${index() === props.bookEmulatorIndex() ? "active" : ""}`}
                    type="button"
                    onClick={() => props.goBookEmulatorToIndex(index())}
                  >
                    <span>{sheet.subtitle}</span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </section>
  );
}
