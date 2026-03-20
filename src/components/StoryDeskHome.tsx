import { For, Show } from "solid-js";

export default function StoryDeskHome(props: any) {
  return (
    <section class="story-desk" aria-label="Story desk">
      <aside class="story-desk-rail">
        <div class="story-desk-header">
          <div>
            <p class="section-label">Story desk</p>
            <h2>{props.homeShelfTab() === "published" ? "Published library" : "Recent drafts"}</h2>
            <p class="subtle-text">
              {props.homeShelfTab() === "published"
                ? "Browse stories the community has already published."
                : "Re-open work, scan progress, and keep the next story queued up."}
            </p>
          </div>
          <div class="home-shelf-tabs" role="tablist" aria-label="Homepage story shelves">
            <button
              class={`home-shelf-tab ${props.homeShelfTab() === "private" ? "active" : ""}`}
              type="button"
              role="tab"
              aria-selected={props.homeShelfTab() === "private"}
              onClick={() => {
                props.setHomeShelfTab("private");
                props.setStoryDeskFilter("all");
              }}
            >
              My stories
            </button>
            <button
              class={`home-shelf-tab ${props.homeShelfTab() === "published" ? "active" : ""}`}
              type="button"
              role="tab"
              aria-selected={props.homeShelfTab() === "published"}
              onClick={() => {
                props.setHomeShelfTab("published");
                props.setStoryDeskFilter("all");
              }}
            >
              Published library
            </button>
          </div>
          <label class="story-desk-search">
            <span class="story-desk-search-label">Search</span>
            <input
              type="search"
              placeholder={
                props.homeShelfTab() === "published"
                  ? "Find a published story..."
                  : "Find a story..."
              }
              value={props.storyDeskQuery()}
              onInput={(event) => props.setStoryDeskQuery(event.currentTarget.value)}
            />
          </label>
          <Show when={props.homeShelfTab() === "private"}>
            <div class="story-desk-filters">
              <span class="story-desk-filter-label">Filter</span>
              <div class="story-desk-filter-chips">
                <button
                  class={`filter-chip ${props.storyDeskFilter() === "all" ? "active" : ""}`}
                  type="button"
                  onClick={() => props.setStoryDeskFilter("all")}
                >
                  All
                  <span class="filter-count">{props.activeHomeEntries().length}</span>
                </button>
                <button
                  class={`filter-chip ${props.storyDeskFilter() === "draft" ? "active" : ""}`}
                  type="button"
                  onClick={() => props.setStoryDeskFilter("draft")}
                >
                  Draft
                  <span class="filter-count">{props.activeHomeCounts().draft}</span>
                </button>
                <button
                  class={`filter-chip ${props.storyDeskFilter() === "review" ? "active" : ""}`}
                  type="button"
                  onClick={() => props.setStoryDeskFilter("review")}
                >
                  Review
                  <span class="filter-count">{props.activeHomeCounts().review}</span>
                </button>
                <button
                  class={`filter-chip ${props.storyDeskFilter() === "ready" ? "active" : ""}`}
                  type="button"
                  onClick={() => props.setStoryDeskFilter("ready")}
                >
                  Ready
                  <span class="filter-count">{props.activeHomeCounts().ready}</span>
                </button>
                <button
                  class={`filter-chip ${props.storyDeskFilter() === "published" ? "active" : ""}`}
                  type="button"
                  onClick={() => props.setStoryDeskFilter("published")}
                >
                  Published
                  <span class="filter-count">{props.activeHomeCounts().published}</span>
                </button>
              </div>
            </div>
          </Show>
        </div>
        <div class="story-list" ref={props.setStoryDeskScrollEl}>
          <Show
            when={props.filteredStoryDeskEntries().length > 0}
            fallback={
              <div class="story-list-empty">
                <p>
                  {props.activeHomeError()
                    ? props.activeHomeError()
                    : props.storyDeskQuery().trim()
                      ? "No matches yet. Try another keyword."
                      : props.homeShelfTab() === "private" && props.storyDeskFilter() !== "all"
                        ? "No stories match this status filter yet."
                        : props.homeShelfTab() === "published"
                          ? "No published stories are visible yet."
                          : "No stories yet. Start in the studio to save your first draft."}
                </p>
                <Show
                  when={
                    !props.activeHomeError() &&
                    !props.storyDeskQuery().trim() &&
                    props.storyDeskFilter() === "all" &&
                    props.homeShelfTab() === "private"
                  }
                >
                  <button class="button primary" type="button" onClick={props.openStudio}>
                    Start first draft
                  </button>
                </Show>
              </div>
            }
          >
            <For each={props.filteredStoryDeskEntries()}>
              {(item) => (
                <button
                  class={`story-card-mini ${props.selectedStoryId() === item.id ? "active" : ""}`}
                  type="button"
                  data-story-id={item.id}
                  onPointerDown={() => props.selectStoryDeskEntry(item)}
                  onFocus={() => props.selectStoryDeskEntry(item)}
                  onClick={() => props.selectStoryDeskEntry(item)}
                >
                  <div class="story-card-mini-top">
                    <span class={`story-status ${item.statusTone}`}>{item.status}</span>
                    <span class="story-time">{item.updatedAt}</span>
                  </div>
                  <strong>{item.title}</strong>
                  <Show when={item.visibility === "public"}>
                    <p class="story-card-owner">Published by {item.ownerUsername}</p>
                  </Show>
                  <p>{item.summary}</p>
                  <div class="story-tags">
                    <For each={item.tags}>{(tag) => <span>{tag}</span>}</For>
                  </div>
                </button>
              )}
            </For>
          </Show>
          <Show when={!props.storyDeskQuery().trim() && !props.activeHomeError()}>
            <Show
              when={props.activeHomeHasMore()}
              fallback={
                <div class="story-list-end">
                  {props.homeShelfTab() === "published"
                    ? "You reached the end of the published shelf."
                    : "Start of your archive."}
                </div>
              }
            >
              <div
                class={`story-list-sentinel ${props.activeHomeLoading() ? "loading" : ""}`}
                ref={props.setStoryDeskSentinel}
              >
                {props.activeHomeLoading()
                  ? props.homeShelfTab() === "published"
                    ? "Loading published stories..."
                    : "Loading older drafts..."
                  : props.homeShelfTab() === "published"
                    ? "Scroll for more published stories"
                    : "Scroll for older drafts"}
              </div>
            </Show>
          </Show>
        </div>
      </aside>

      <div class="story-desk-main">
        <Show
          when={props.activeStory()}
          fallback={
            <article class="panel story-spotlight story-empty">
              <div class="panel-header">
                <p class="panel-kicker">Story desk</p>
                <h2>No stories yet</h2>
              </div>
              <p class="story-spotlight-summary">
                Start a new draft in the studio to build your first story entry.
              </p>
              <button class="button primary" type="button" onClick={props.openStudio}>
                Start drafting
              </button>
            </article>
          }
        >
          {(story) => (
            <article class="panel story-spotlight">
              <div class="panel-header">
                <p class="panel-kicker">
                  {story().visibility === "public" ? "Published library" : "Story desk"}
                </p>
                <h2>{story().title}</h2>
                <div class="story-spotlight-meta">
                  <span class={`story-status ${story().statusTone}`}>{story().status}</span>
                  <span class="story-time">{story().updatedAt}</span>
                  <Show when={story().visibility === "public"}>
                    <span class="story-owner-inline">By {story().ownerUsername}</span>
                  </Show>
                </div>
              </div>
              <p class="story-spotlight-summary">{story().summary}</p>

              <div class="story-spotlight-grid">
                <div class="story-spotlight-panel">
                  <p class="detail-label">Opening line</p>
                  <p>{story().openingLine}</p>
                </div>
                <div class="story-spotlight-panel">
                  <p class="detail-label">Prompt focus</p>
                  <p>{story().prompt}</p>
                </div>
              </div>

              <Show
                when={
                  story().visibility === "public" &&
                  story().finalStorySnapshot &&
                  story().finalStorySnapshot!.pages.length > 0
                }
              >
                <div class="story-published-preview">
                  <div class="story-published-preview-header">
                    <div>
                      <p class="detail-label">Published preview</p>
                      <strong>
                        Page {props.publishedPreviewPageIndex() + 1} of{" "}
                        {props.activePublishedStoryPageCount()}
                      </strong>
                    </div>
                    <div class="story-published-preview-nav">
                      <button
                        class="button ghost"
                        type="button"
                        onClick={() =>
                          props.setPublishedPreviewPageIndex((current: number) =>
                            Math.max(0, current - 1),
                          )
                        }
                        disabled={props.publishedPreviewPageIndex() === 0}
                      >
                        Previous page
                      </button>
                      <button
                        class="button ghost"
                        type="button"
                        onClick={() =>
                          props.setPublishedPreviewPageIndex((current: number) =>
                            Math.min(props.activePublishedStoryPageCount() - 1, current + 1),
                          )
                        }
                        disabled={
                          props.publishedPreviewPageIndex() >=
                          props.activePublishedStoryPageCount() - 1
                        }
                      >
                        Next page
                      </button>
                    </div>
                  </div>
                  <div class="story-published-preview-body">
                    <Show when={props.activePublishedPreviewImage()}>
                      <img
                        class="story-published-preview-image"
                        src={props.activePublishedPreviewImage()!}
                        alt={`${story().title} page ${props.publishedPreviewPageIndex() + 1}`}
                        loading="lazy"
                        decoding="async"
                        fetchpriority="low"
                      />
                    </Show>
                    <div class="story-published-preview-copy">
                      <p>{props.activePublishedPreviewText()}</p>
                    </div>
                  </div>
                </div>
              </Show>

              <div class="story-beats">
                <p class="detail-label">Story beats</p>
                <div class="story-beat-grid">
                  <For each={story().beats}>
                    {(beat, index) => (
                      <div class="story-beat">
                        <span>{index() + 1}</span>
                        <p>{beat}</p>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </article>
          )}
        </Show>
      </div>

      <aside class="story-desk-aside">
        <Show
          when={props.activeStory()}
          fallback={
            <article class="panel story-meta-panel">
              <div class="panel-header">
                <p class="panel-kicker">Details</p>
                <h3>No story selected</h3>
              </div>
              <p class="subtle-text">
                Choose a draft from the list to review progress and open it in the studio.
              </p>
            </article>
          }
        >
          {(story) => (
            <>
              <article class="panel story-meta-panel">
                <div class="panel-header">
                  <p class="panel-kicker">Details</p>
                  <h3>At a glance</h3>
                </div>
                <div class="story-meta-list">
                  <For each={story().meta}>
                    {(item) => (
                      <div class="story-meta-item">
                        <span class="detail-label">{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    )}
                  </For>
                </div>
              </article>

              <article class="panel story-actions">
                <div class="panel-header">
                  <p class="panel-kicker">Actions</p>
                  <h3>{story().visibility === "public" ? "View options" : "Next steps"}</h3>
                </div>
                <div class="story-actions-grid">
                  <Show
                    when={story().visibility === "private" || story().viewerOwnsEntry}
                    fallback={
                      <div class="story-public-note">
                        This story is published publicly. Browse its pages here in the library;
                        only the creator can edit it in Studio.
                      </div>
                    }
                  >
                    <button
                      class="button ghost"
                      type="button"
                      onClick={() => props.requestStoryOpen(story())}
                    >
                      Open in studio
                    </button>
                    <Show when={story().visibility === "private"}>
                      <button
                        class="button ghost danger"
                        type="button"
                        onClick={() => props.requestDeleteStory(story())}
                      >
                        Delete story
                      </button>
                    </Show>
                  </Show>
                </div>
              </article>
            </>
          )}
        </Show>
      </aside>
    </section>
  );
}
