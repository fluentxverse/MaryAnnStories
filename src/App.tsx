import { For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js";

const logoUrl = new URL("../assets/logo.png", import.meta.url).href;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

type ColorMode = "light" | "dark";
type WorkspaceTab = "request" | "output" | "final" | "images";
type WorkspaceView = "home" | "studio";
type AuthMode = "login" | "register";
type SpreadLayout = "full" | "split";
type RouteState = {
  view: WorkspaceView;
  tab?: WorkspaceTab;
  story?: string | null;
};

type BuilderState = {
  theme: string;
  protagonist: string;
  sidekick: string;
  protagonistTrait: string;
  additionalCharacters: string[];
  setting: string;
  themeLesson: string;
  ageBand: string;
  genre: string;
  mood: string;
  narrativeStyle: string;
  endingType: string;
  artStyle: string;
  language: string;
  conflictType: string;
  illustrationConsistency: string;
  safetyConstraints: string;
  spreads: number;
};

type StoryPlan = {
  title: string;
  metadataLine: string;
  synopsis: string;
  openingLine: string;
  coverPrompt: string;
  palette: string[];
  storyBeats: string[];
  illustrationNotes: string[];
};

type ImageSettings = {
  bookSize: string;
  spreadLayout: SpreadLayout;
  aspectRatio: string;
  imageSize: string;
  variationCount: number;
  coverFocus: string;
  characterPromptNotes: string;
  scenePromptNotes: string;
  negativePrompt: string;
};

type BookSizeOption = {
  id: string;
  label: string;
  shortLabel: string;
  width: number;
  height: number;
  aspectRatio: string;
  imageSize: string;
};

type ImagePromptEntry = {
  title: string;
  detail: string;
  prompt: string;
};

type ImageAssetCard = {
  title: string;
  kind: string;
  note: string;
  detail: string;
  gradient: string;
  featured?: boolean;
};

type ImagePlan = {
  packageLine: string;
  effectiveNegativePrompt: string;
  coverPrompt: string;
  characterPrompts: ImagePromptEntry[];
  scenePrompts: ImagePromptEntry[];
  assetCards: ImageAssetCard[];
};

type ImageStep = {
  id: string;
  label: string;
  kind: "cover" | "page";
  prompt: string;
  pageIndex?: number;
};

type ImageStepResult = {
  status: "idle" | "generated" | "saved";
  imageUrl?: string;
  storedUrl?: string;
  generatedAt?: string;
};

type ImageModalItem = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  source: "generated";
  prompt?: string;
  meta: Array<{ label: string; value: string }>;
};

type FinalStorySnapshot = {
  title: string;
  subtitle: string;
  pages: string[];
};

type StoryStatusTone = "draft" | "review" | "illustration" | "ready" | "published";

type DraftRequiredFieldKey =
  | "theme"
  | "protagonist"
  | "setting"
  | "themeLesson"
  | "ageBand"
  | "genre"
  | "mood"
  | "narrativeStyle"
  | "endingType"
  | "spreads";

type StoryDeskEntry = {
  id: string;
  status: string;
  statusTone: StoryStatusTone;
  title: string;
  updatedAt: string;
  updatedAtRaw?: string;
  summary: string;
  openingLine: string;
  prompt: string;
  beats: string[];
  tags: string[];
  meta: Array<{ label: string; value: string }>;
  builderSnapshot: BuilderState;
  imageSettingsSnapshot: ImageSettings;
  planSnapshot: StoryPlan;
  finalStorySnapshot?: FinalStorySnapshot | null;
  draftResponseText?: string | null;
  imageResultsSnapshot?: Record<string, ImageStepResult>;
  ready: boolean;
  published: boolean;
  generatedAt?: string | null;
};

type StoryRecordResponse = {
  id: string;
  username: string;
  title?: string | null;
  summary?: string | null;
  prompt?: string | null;
  status: string;
  ready: boolean;
  published: boolean;
  builder_json?: string | null;
  image_settings_json?: string | null;
  story_plan_json?: string | null;
  final_story_json?: string | null;
  draft_response_text?: string | null;
  image_results_json?: string | null;
  created_at: string;
  updated_at: string;
};

type StoryListResponse = {
  status: string;
  has_more: boolean;
  stories: StoryRecordResponse[];
};

type StoryUpsertResponse = {
  status: string;
  id: string;
  created_at: string;
  updated_at: string;
};

type ImageRecordResponse = {
  id: number;
  story_id: string;
  url?: string | null;
  source_url?: string | null;
  kind: "cover" | "page";
  page_index?: number | null;
  prompt?: string | null;
  created_at: string;
};

type ImageListResponse = {
  status: string;
  images: ImageRecordResponse[];
};

const ageBands = [
  "Ages 3-5",
  "Ages 5-7",
  "Ages 7-9",
  "Family read-aloud",
];

const genres = [
  "Wonder-filled adventure",
  "Bedtime calm",
  "Friendship journey",
  "Nature mystery",
  "Fantasy lesson",
  "Science-flavored quest",
];

const moods = [
  "Playful",
  "Tender",
  "Brave",
  "Dreamy",
  "Cozy",
  "Epic",
];

const artStyles = [
  "Painted watercolor",
  "Cut-paper collage",
  "Soft gouache",
  "Golden storybook ink",
  "Whimsical pastel",
  "Moonlit pencil",
];

const endingTypes = [
  "Happy and resolved",
  "Calm bedtime landing",
  "Bittersweet but hopeful",
  "Twist ending",
  "Full-circle homecoming",
];

const narrativeStyles = [
  "Simple prose",
  "Rhythmic read-aloud",
  "Dialogue-forward",
  "Lyrical narration",
  "Playful narrator",
];

const languages = [
  "English (US)",
  "English (UK)",
  "English (Philippines)",
  "Spanish",
  "Tagalog",
];

const conflictTypes = [
  "Internal fear",
  "Friendship misunderstanding",
  "Nature obstacle",
  "Time pressure",
  "Puzzle or mystery",
  "Responsibility vs desire",
];

const imageAspectRatios = [
  "3:4 portrait",
  "4:5 cover",
  "1:1 square",
  "16:9 cinematic",
  "7:9 portrait",
  "5:4 landscape",
];

const imageSizes = ["1024 px", "1536 px", "2048 px"];

const coverFocusModes = [
  "Book cover composition",
  "Character-led cover",
  "World-led cover",
  "Typography-safe cover",
];

const bookSizes: BookSizeOption[] = [
  {
    id: "8x8",
    label: "8 x 8 in (Square)",
    shortLabel: "8x8",
    width: 8,
    height: 8,
    aspectRatio: "1:1 square",
    imageSize: "1536 px",
  },
  {
    id: "8x10",
    label: "8 x 10 in (Portrait)",
    shortLabel: "8x10",
    width: 8,
    height: 10,
    aspectRatio: "4:5 cover",
    imageSize: "1536 px",
  },
  {
    id: "7x9",
    label: "7 x 9 in (Portrait)",
    shortLabel: "7x9",
    width: 7,
    height: 9,
    aspectRatio: "7:9 portrait",
    imageSize: "1536 px",
  },
  {
    id: "10x8",
    label: "10 x 8 in (Landscape)",
    shortLabel: "10x8",
    width: 10,
    height: 8,
    aspectRatio: "5:4 landscape",
    imageSize: "1536 px",
  },
];

const spreadLayoutOptions: Array<{ id: SpreadLayout; label: string; note: string }> = [
  {
    id: "full",
    label: "Full spread image",
    note: "One image flows across both pages with text overlay.",
  },
  {
    id: "split",
    label: "Split left / right",
    note: "Left and right pages are separate illustrations.",
  },
];

const getBookSize = (id: string) =>
  bookSizes.find((option) => option.id === id) ?? bookSizes[1] ?? bookSizes[0]!;

const getSpreadLayoutLabel = (layout: SpreadLayout) =>
  spreadLayoutOptions.find((option) => option.id === layout)?.label ??
  "Full spread image";

const cloneBuilder = (state: BuilderState): BuilderState => ({
  ...state,
  additionalCharacters: [...state.additionalCharacters],
});

const cloneImageSettings = (settings: ImageSettings): ImageSettings => ({ ...settings });

const workspaceTabs: Array<{ id: WorkspaceTab; label: string; note: string }> = [
  {
    id: "request",
    label: "Parameters",
    note: "Build the request with the full control set.",
  },
  {
    id: "output",
    label: "Output",
    note: "Inspect the generated draft and request payload.",
  },
  {
    id: "final",
    label: "Final",
    note: "Read the finalized story output.",
  },
  {
    id: "images",
    label: "Images",
    note: "Prepare cover, character, and scene prompts.",
  },
];

const draftRequiredFields: Array<{ key: DraftRequiredFieldKey; label: string }> = [
  { key: "theme", label: "Prompt" },
  { key: "protagonist", label: "Protagonist" },
  { key: "setting", label: "Setting / world" },
  { key: "themeLesson", label: "Theme / lesson" },
  { key: "ageBand", label: "Age band" },
  { key: "genre", label: "Genre" },
  { key: "mood", label: "Mood" },
  { key: "narrativeStyle", label: "Narrative style" },
  { key: "endingType", label: "Ending type" },
  { key: "spreads", label: "Spreads" },
];

const initialState: BuilderState = {
  theme: "",
  protagonist: "",
  sidekick: "",
  protagonistTrait: "",
  additionalCharacters: [],
  setting: "",
  themeLesson: "",
  ageBand: ageBands[0],
  genre: genres[0],
  mood: moods[0],
  narrativeStyle: narrativeStyles[0],
  endingType: endingTypes[0],
  artStyle: artStyles[0],
  language: languages[0],
  conflictType: conflictTypes[0],
  illustrationConsistency: "",
  safetyConstraints: "",
  spreads: 10,
};

const resetState: BuilderState = {
  theme: "",
  protagonist: "",
  sidekick: "",
  protagonistTrait: "",
  additionalCharacters: [],
  setting: "",
  themeLesson: "",
  ageBand: ageBands[0],
  genre: genres[0],
  mood: moods[0],
  narrativeStyle: narrativeStyles[0],
  endingType: endingTypes[0],
  artStyle: artStyles[0],
  language: languages[0],
  conflictType: conflictTypes[0],
  illustrationConsistency: "",
  safetyConstraints: "",
  spreads: 10,
};

const initialImageSettings: ImageSettings = {
  bookSize: bookSizes[1]?.id ?? "8x10",
  spreadLayout: "full",
  aspectRatio: bookSizes[1]?.aspectRatio ?? imageAspectRatios[0],
  imageSize: bookSizes[1]?.imageSize ?? imageSizes[1],
  variationCount: 4,
  coverFocus: coverFocusModes[0],
  characterPromptNotes:
    "full-body reference, expression sheet, and clean silhouette for repeatable art",
  scenePromptNotes:
    "cover image, opening spread, midpoint turn, and final tableau with strong page-turn readability",
  negativePrompt: "",
};

const getInitialColorMode = (): ColorMode => {
  if (typeof window === "undefined") {
    return "dark";
  }

  const storedMode = window.localStorage.getItem("mary-ann-stories-color-mode");

  if (storedMode === "light" || storedMode === "dark") {
    return storedMode;
  }

  return "dark";
};

const getInitialWorkspace = (): WorkspaceView => {
  if (typeof window === "undefined") {
    return "home";
  }

  const storedView = window.localStorage.getItem("mary-ann-stories-workspace");
  if (storedView === "studio" || storedView === "home") {
    return storedView;
  }

  return "home";
};

const applyColorMode = (mode: ColorMode) => {
  if (typeof document === "undefined") {
    return;
  }

  document.body.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
};

const formatTimestamp = (value?: string | null) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatRelativeTime = (value: string, _tick?: number) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  const seconds = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const mapSavedImagesToResults = (images: ImageRecordResponse[]) => {
  const results: Record<string, ImageStepResult> = {};
  for (const image of images) {
    let stepId: string | null = null;
    if (image.kind === "cover") {
      stepId = "cover";
    } else if (image.kind === "page" && typeof image.page_index === "number") {
      stepId = `page-${image.page_index + 1}`;
    }
    if (!stepId) continue;
    const url =
      typeof image.url === "string"
        ? image.url
        : typeof image.source_url === "string"
          ? image.source_url
          : null;
    results[stepId] = {
      status: "saved",
      imageUrl: url ?? undefined,
      storedUrl: url ?? undefined,
      generatedAt: formatTimestamp(image.created_at),
    };
  }
  return results;
};

const safeParseJson = <T,>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const resolveApiErrorMessage = (
  response: Response,
  payload: unknown,
  rawText: string,
  fallback: string,
) => {
  if (payload && typeof payload === "object") {
    const data = payload as { error?: unknown; detail?: unknown };
    const message =
      typeof data.error === "string" && data.error.trim().length > 0
        ? data.error.trim()
        : fallback;
    const detail =
      typeof data.detail === "string" && data.detail.trim().length > 0
        ? data.detail.trim()
        : "";
    return detail ? `${message} (${detail})` : message;
  }

  const trimmed = rawText.trim();
  if (trimmed.length > 0) {
    return `${fallback} (${trimmed.slice(0, 160)})`;
  }

  return `${fallback} (HTTP ${response.status})`;
};

const normalizeBuilderSnapshot = (value: string | null | undefined): BuilderState => {
  const parsed = safeParseJson<Partial<BuilderState>>(value, {});
  const additionalCharacters = Array.isArray(parsed.additionalCharacters)
    ? parsed.additionalCharacters.filter((item): item is string => typeof item === "string")
    : initialState.additionalCharacters;
  return {
    ...initialState,
    ...parsed,
    additionalCharacters,
  };
};

const normalizeImageSettingsSnapshot = (
  value: string | null | undefined,
): ImageSettings => {
  const parsed = safeParseJson<Partial<ImageSettings>>(value, {});
  return {
    ...initialImageSettings,
    ...parsed,
  };
};

const normalizeStoryPlanSnapshot = (
  value: string | null | undefined,
  builderSnapshot: BuilderState,
): StoryPlan => {
  const base = buildStoryPlan(builderSnapshot);
  const parsed = safeParseJson<Partial<StoryPlan>>(value, {});
  return {
    ...base,
    ...parsed,
    palette: Array.isArray(parsed.palette) ? parsed.palette : base.palette,
    storyBeats: Array.isArray(parsed.storyBeats) ? parsed.storyBeats : base.storyBeats,
    illustrationNotes: Array.isArray(parsed.illustrationNotes)
      ? parsed.illustrationNotes
      : base.illustrationNotes,
  };
};

const normalizeFinalStorySnapshot = (
  value: string | null | undefined,
): FinalStorySnapshot | null => {
  const parsed = safeParseJson<FinalStorySnapshot | null>(value, null);
  if (!parsed) return null;
  return {
    title: parsed.title ?? "Untitled story",
    subtitle: parsed.subtitle ?? "",
    pages: Array.isArray(parsed.pages) ? parsed.pages : [],
  };
};

const normalizeImageResultsSnapshot = (
  value: string | null | undefined,
): Record<string, ImageStepResult> => {
  const parsed = safeParseJson<Record<string, ImageStepResult>>(value, {});
  const results: Record<string, ImageStepResult> = {};
  if (!parsed || typeof parsed !== "object") return results;

  for (const [key, entry] of Object.entries(parsed)) {
    if (!entry || typeof entry !== "object") continue;
    const status =
      entry.status === "generated" || entry.status === "saved" ? entry.status : "idle";
    results[key] = {
      status,
      imageUrl: typeof entry.imageUrl === "string" ? entry.imageUrl : undefined,
      storedUrl: typeof entry.storedUrl === "string" ? entry.storedUrl : undefined,
      generatedAt: typeof entry.generatedAt === "string" ? entry.generatedAt : undefined,
    };
  }

  return results;
};

const resolveStoryStatus = (
  status: string,
  ready: boolean,
  published: boolean,
) => {
  const normalized = status.trim().toLowerCase();
  if (published || normalized === "published") {
    return { label: "Published", tone: "published" as StoryStatusTone, value: "published" };
  }
  if (ready || normalized === "ready") {
    return { label: "Ready", tone: "ready" as StoryStatusTone, value: "ready" };
  }
  if (normalized === "review") {
    return { label: "Review", tone: "review" as StoryStatusTone, value: "review" };
  }
  if (normalized === "illustration" || normalized === "illustrating") {
    return {
      label: "Illustrating",
      tone: "illustration" as StoryStatusTone,
      value: "illustration",
    };
  }
  return { label: "Draft", tone: "draft" as StoryStatusTone, value: "draft" };
};

const buildStoryTags = (builderSnapshot: BuilderState) =>
  [builderSnapshot.genre, builderSnapshot.mood, builderSnapshot.ageBand].filter(
    (value): value is string => Boolean(value),
  );

const buildStoryMeta = (
  builderSnapshot: BuilderState,
  imageSettingsSnapshot: ImageSettings,
  ready: boolean,
  published: boolean,
) => {
  const bookSize = getBookSize(imageSettingsSnapshot.bookSize);
  return [
    { label: "Language", value: builderSnapshot.language },
    { label: "Art style", value: builderSnapshot.artStyle },
    { label: "Spreads", value: String(builderSnapshot.spreads) },
    { label: "Book size", value: bookSize.shortLabel },
    { label: "Image size", value: imageSettingsSnapshot.imageSize },
    { label: "Ready", value: ready ? "Yes" : "Not yet" },
    { label: "Published", value: published ? "Yes" : "No" },
  ];
};

const buildStoryDeskEntryFromRecord = (record: StoryRecordResponse): StoryDeskEntry => {
  const builderSnapshot = normalizeBuilderSnapshot(record.builder_json);
  const imageSettingsSnapshot = normalizeImageSettingsSnapshot(record.image_settings_json);
  const planSnapshot = normalizeStoryPlanSnapshot(record.story_plan_json, builderSnapshot);
  const finalStorySnapshot = normalizeFinalStorySnapshot(record.final_story_json);
  const imageResultsSnapshot = normalizeImageResultsSnapshot(record.image_results_json);
  const statusInfo = resolveStoryStatus(record.status ?? "draft", record.ready, record.published);
  const updatedAt = formatTimestamp(record.updated_at);

  return {
    id: record.id,
    status: statusInfo.label,
    statusTone: statusInfo.tone,
    title: record.title ?? planSnapshot.title,
    updatedAt,
    updatedAtRaw: record.updated_at,
    summary: record.summary ?? planSnapshot.synopsis,
    openingLine: planSnapshot.openingLine,
    prompt: record.prompt ?? builderSnapshot.theme,
    beats: planSnapshot.storyBeats,
    tags: buildStoryTags(builderSnapshot),
    meta: buildStoryMeta(builderSnapshot, imageSettingsSnapshot, record.ready, record.published),
    builderSnapshot,
    imageSettingsSnapshot,
    planSnapshot,
    finalStorySnapshot,
    draftResponseText: record.draft_response_text ?? null,
    imageResultsSnapshot,
    ready: record.ready,
    published: record.published,
    generatedAt: record.updated_at,
  };
};

const capitalize = (value: string) =>
  value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value;

const formatCastList = (names: string[]) => {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
};

const parseWorkspaceView = (value: string | null) =>
  value === "home" || value === "studio" ? value : null;

const parseWorkspaceTab = (value: string | null) =>
  value === "request" || value === "output" || value === "final" || value === "images"
    ? value
    : null;

const readRouteState = (): RouteState | null => {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const view = parseWorkspaceView(params.get("view"));
  const tab = parseWorkspaceTab(params.get("tab"));
  const story = params.get("story");
  const resolvedView = view ?? (tab || story ? "studio" : null);
  if (!resolvedView) return null;
  return {
    view: resolvedView,
    tab: tab ?? undefined,
    story: story ?? null,
  };
};

const buildRouteUrl = (state: RouteState) => {
  const params = new URLSearchParams();
  params.set("view", state.view);
  if (state.view === "studio" && state.tab) {
    params.set("tab", state.tab);
  }
  if (state.view === "studio" && state.story) {
    params.set("story", state.story);
  }
  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ""}`;
};

const buildGradient = (start: string, end: string) =>
  `linear-gradient(135deg, ${start} 0%, ${end} 100%)`;

const formatTraitLabel = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  const nounish = /(ness|ity|tion|sion|ment|ship|hood|ence|ance|ism|ing|age|ery|ory|acy)$/iu.test(
    lower,
  );
  return nounish ? lower : `${lower} streak`;
};

const deriveTitleSubject = (idea: string) => {
  const subject = idea
    .replace(/^[Aa]n?\s+/u, "")
    .replace(
      /\b(learns|discovers|finds|helps|saves|tries|must|sets out|wants|needs|dreams)\b.*$/iu,
      "",
    )
    .trim();

  if (!subject) {
    return "";
  }

  if (/^the\s+/iu.test(subject)) {
    return capitalize(subject);
  }

  return `the ${capitalize(subject)}`;
};

const buildStoryPlan = (state: BuilderState): StoryPlan => {
  const themeText = state.theme.trim();
  const protagonist = state.protagonist.trim();
  const sidekick = state.sidekick.trim();
  const protagonistTrait = state.protagonistTrait.trim();
  const protagonistTraitLabel = formatTraitLabel(protagonistTrait);
  const extraCharacters = (state.additionalCharacters ?? [])
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  const setting = state.setting.trim();
  const lesson = state.themeLesson.trim();
  const narrativeStyle = state.narrativeStyle.trim();
  const endingType = state.endingType.trim();
  const language = state.language.trim();
  const conflictType = state.conflictType.trim();
  const illustrationConsistency = state.illustrationConsistency.trim();
  const safetyConstraints = state.safetyConstraints.trim();
  const leadIdea = themeText.split(/[.!?]/)[0]?.trim();
  const storyCore = leadIdea ? deriveTitleSubject(leadIdea) : "";
  const toneLabel = state.mood.toLowerCase();
  const genreLabel = state.genre.toLowerCase();
  const artLabel = state.artStyle.toLowerCase();
  const spreadCount = Math.max(6, Math.min(16, state.spreads));
  const lowerLeadIdea = leadIdea
    ? `${leadIdea.charAt(0).toLowerCase()}${leadIdea.slice(1)}`
    : "";
  const castList = [protagonist, sidekick, ...extraCharacters].filter(
    (value) => value.length > 0,
  );
  const castLine = formatCastList(castList);
  const canBuildSynopsis =
    Boolean(themeText) &&
    Boolean(castLine) &&
    Boolean(setting) &&
    Boolean(lesson) &&
    Boolean(narrativeStyle) &&
    Boolean(endingType) &&
    Boolean(language);
  const canBuildOpeningLine = Boolean(setting) && Boolean(protagonist);
  const canBuildBeats =
    Boolean(setting) &&
    Boolean(lowerLeadIdea) &&
    Boolean(protagonist) &&
    Boolean(conflictType) &&
    Boolean(lesson) &&
    Boolean(narrativeStyle) &&
    Boolean(endingType);
  const canBuildIllustrationNotes =
    Boolean(artLabel) && Boolean(illustrationConsistency) && Boolean(setting);
  const canBuildCoverPrompt =
    Boolean(artLabel) &&
    Boolean(castLine) &&
    Boolean(setting) &&
    Boolean(lesson) &&
    Boolean(illustrationConsistency) &&
    Boolean(language);

  const colorPalettes: Record<string, string[]> = {
    Playful: ["#f59e0b", "#ec4899", "#38bdf8"],
    Tender: ["#f9a8d4", "#93c5fd", "#c4b5fd"],
    Brave: ["#ef4444", "#f59e0b", "#14b8a6"],
    Dreamy: ["#818cf8", "#e879f9", "#86efac"],
    Cozy: ["#d97706", "#a16207", "#84cc16"],
    Epic: ["#fb7185", "#64748b", "#f59e0b"],
  };

  return {
    title:
      protagonist && storyCore
        ? `${capitalize(protagonist)} and ${storyCore}`
        : protagonist
          ? capitalize(protagonist)
          : storyCore
            ? capitalize(storyCore)
            : "Untitled story",
    metadataLine: `${state.ageBand} / ${state.genre} / ${state.artStyle} / ${language || "—"}`,
    synopsis: canBuildSynopsis
      ? `${spreadCount}-spread ${narrativeStyle.toLowerCase()} draft in ${language}. ${castLine} move through a ${toneLabel} ${genreLabel} set in ${setting.toLowerCase()}, using "${leadIdea}" to land ${lesson.toLowerCase()} with a ${endingType.toLowerCase()} ending.`
      : "",
    openingLine: canBuildOpeningLine
      ? `In ${setting.toLowerCase()}, ${protagonist}${
          protagonistTraitLabel ? ` kept their ${protagonistTraitLabel} hidden` : ""
        } until the morning the sky forgot how to whisper.`
      : "",
    coverPrompt: canBuildCoverPrompt
      ? `${artLabel} picture-book cover, ${castLine} in ${setting}, focus on ${lesson.toLowerCase()}, ${illustrationConsistency}, safe-for-children composition, ${language}`
      : "",
    palette: colorPalettes[state.mood] ?? colorPalettes.Dreamy,
    storyBeats: canBuildBeats
      ? [
          `Open in ${setting.toLowerCase()} and establish that ${lowerLeadIdea}.`,
          sidekick
            ? `${sidekick} challenges ${protagonist}${
                protagonistTraitLabel ? `'s ${protagonistTraitLabel}` : ""
              } as the ${conflictType.toLowerCase()} escalates.`
            : `${protagonist} faces the ${conflictType.toLowerCase()} as it escalates${
                protagonistTraitLabel
                  ? `, testing their ${protagonistTraitLabel}`
                  : ""
              }.`,
          `A midpoint turn reframes the story around ${lesson.toLowerCase()} while preserving a ${narrativeStyle.toLowerCase()} reading rhythm.`,
          `${protagonist} takes action that resolves the ${conflictType.toLowerCase()} instead of avoiding it.`,
          `Close with a ${endingType.toLowerCase()} ending that makes the change visible on the final spread.`,
        ]
      : [],
    illustrationNotes: canBuildIllustrationNotes
      ? [
          `Maintain ${artLabel} rendering with ${illustrationConsistency}.`,
          `Treat ${setting.toLowerCase()} as the recurring visual anchor across the book.`,
          ...(narrativeStyle
            ? [`Match page-turn pacing to a ${toneLabel} ${narrativeStyle.toLowerCase()} cadence.`]
            : []),
          ...(safetyConstraints ? [`Respect guardrails: ${safetyConstraints}.`] : []),
          ...(extraCharacters.length > 0
            ? [`Supporting cast: ${extraCharacters.join(", ")}.`]
            : []),
        ]
      : [],
  };
};

const buildImagePlan = (
  state: BuilderState,
  story: StoryPlan,
  settings: ImageSettings,
): ImagePlan => {
  const protagonist = state.protagonist.trim();
  const sidekick = state.sidekick.trim();
  const protagonistTrait = state.protagonistTrait.trim();
  const extraCharacters = (state.additionalCharacters ?? [])
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  const extraCastLabel = extraCharacters.join(", ");
  const setting = state.setting.trim();
  const lesson = state.themeLesson.trim();
  const language = state.language.trim();
  const artLabel = state.artStyle.toLowerCase();
  const bookSize = getBookSize(settings.bookSize);
  const spreadLayoutLabel = getSpreadLayoutLabel(settings.spreadLayout);
  const negativePrompt = settings.negativePrompt.trim() || state.safetyConstraints.trim();
  const characterPromptNotes = settings.characterPromptNotes.trim();
  const scenePromptNotes = settings.scenePromptNotes.trim();
  const coverPromptParts = [
    story.coverPrompt,
    settings.coverFocus.toLowerCase(),
    `book trim ${bookSize.label}`,
    `spread layout: ${spreadLayoutLabel}`,
    `aspect ratio ${settings.aspectRatio}`,
    `output size ${settings.imageSize}`,
    scenePromptNotes,
    negativePrompt ? `negative prompt: ${negativePrompt}` : "",
  ].filter((part) => part.length > 0);
  const coverPrompt = coverPromptParts.join(", ");
  const palette = story.palette.length > 0 ? story.palette : ["#7468ff", "#5f52f3", "#38bdf8"];
  const protagonistPromptParts = [
    artLabel ? `${artLabel} character sheet` : "",
    protagonist,
    protagonistTrait ? protagonistTrait.toLowerCase() : "",
    setting ? `from ${setting}` : "",
    "front view",
    "three-quarter view",
    "expression sheet",
    "pose sheet",
    state.illustrationConsistency,
    characterPromptNotes,
    language,
    negativePrompt ? `negative prompt: ${negativePrompt}` : "",
  ].filter((part) => part.length > 0);
  const sidekickPromptParts = [
    artLabel ? `${artLabel} companion character sheet` : "",
    sidekick,
    protagonist ? `sidekick for ${protagonist}` : "",
    setting ? `from ${setting}` : "",
    "clean silhouette",
    "expressive poses",
    protagonist ? `scale reference beside ${protagonist}` : "",
    state.illustrationConsistency,
    characterPromptNotes,
    language,
    negativePrompt ? `negative prompt: ${negativePrompt}` : "",
  ].filter((part) => part.length > 0);
  const supportPromptParts = [
    artLabel ? `${artLabel} supporting cast character sheet` : "",
    extraCastLabel,
    setting ? `from ${setting}` : "",
    protagonist && sidekick
      ? `grouped with ${protagonist} and ${sidekick} for scale`
      : "",
    state.illustrationConsistency,
    characterPromptNotes,
    language,
    negativePrompt ? `negative prompt: ${negativePrompt}` : "",
  ].filter((part) => part.length > 0);

  return {
    packageLine: `${bookSize.shortLabel} / ${settings.aspectRatio} / ${settings.imageSize} / ${settings.variationCount} variations`,
    effectiveNegativePrompt: negativePrompt,
    coverPrompt,
    characterPrompts: [
      ...(protagonist
        ? [
            {
              title: `${protagonist} reference sheet`,
              detail: `${state.artStyle} / main character`,
              prompt: protagonistPromptParts.join(", "),
            },
          ]
        : []),
      ...(sidekick
        ? [
            {
              title: `${sidekick} reference sheet`,
              detail: `supporting character / companion`,
              prompt: sidekickPromptParts.join(", "),
            },
          ]
        : []),
      ...(extraCharacters.length > 0
        ? [
            {
              title: "Supporting cast reference",
              detail: extraCastLabel,
              prompt: supportPromptParts.join(", "),
            },
          ]
        : []),
    ],
    scenePrompts: [
      {
        title: "Opening spread keyframe",
        detail: "establishing image",
        prompt: `${artLabel} storybook scene, ${story.storyBeats[0]}, set in ${setting}, ${scenePromptNotes}, ${state.illustrationConsistency}, ${language}, negative prompt: ${negativePrompt}`,
      },
      {
        title: "Midpoint keyframe",
        detail: "story turn",
        prompt: `${artLabel} storybook scene, ${story.storyBeats[2]}, cinematic story spread, readable silhouettes, ${scenePromptNotes}, ${state.illustrationConsistency}, ${language}, negative prompt: ${negativePrompt}`,
      },
      {
        title: "Final spread keyframe",
        detail: "resolution image",
        prompt: `${artLabel} final story spread, ${story.storyBeats[4]}, visual focus on ${lesson.toLowerCase()}, calm closing tableau, ${scenePromptNotes}, ${state.illustrationConsistency}, ${language}, negative prompt: ${negativePrompt}`,
      },
    ],
    assetCards: [
      {
        title: "Cover set",
        kind: `${settings.variationCount} cover variants`,
        note: settings.coverFocus,
        detail: settings.packageLine ?? `${settings.aspectRatio} / ${settings.imageSize}`,
        gradient: buildGradient(palette[0], palette[1] ?? palette[0]),
        featured: true,
      },
      {
        title: `${protagonist} model sheet`,
        kind: "Character reference",
        note: protagonistTrait,
        detail: `${state.artStyle} / ${language}`,
        gradient: buildGradient(palette[1] ?? palette[0], palette[2] ?? palette[0]),
      },
      {
        title: `${sidekick} model sheet`,
        kind: "Companion reference",
        note: `${sidekick} beside ${protagonist}`,
        detail: `scaled for repeatable scenes`,
        gradient: buildGradient(palette[2] ?? palette[0], palette[0]),
      },
      ...(extraCharacters.length > 0
        ? [
            {
              title: "Supporting cast sheet",
              kind: "Character reference",
              note: extraCastLabel,
              detail: `${state.artStyle} / ${language}`,
              gradient: buildGradient(palette[1] ?? palette[0], palette[2] ?? palette[0]),
            },
          ]
        : []),
      {
        title: "Scene keyframes",
        kind: "Opening / midpoint / ending",
        note: scenePromptNotes,
        detail: `${bookSize.shortLabel} / ${settings.aspectRatio} / ${settings.imageSize}`,
        gradient: buildGradient(palette[0], palette[2] ?? palette[0]),
        featured: true,
      },
    ],
  };
};

const buildPagePrompt = (
  pageText: string,
  pageIndex: number,
  state: BuilderState,
  plan: StoryPlan,
  image: ImagePlan,
  settings: ImageSettings,
) => {
  const artLabel = state.artStyle.toLowerCase();
  const bookSize = getBookSize(settings.bookSize);
  const spreadLayoutLabel = getSpreadLayoutLabel(settings.spreadLayout);
  return `${artLabel} storybook illustration, page ${
    pageIndex + 1
  }, ${pageText}, set in ${state.setting.toLowerCase()}, ${state.illustrationConsistency}, ${
    plan.metadataLine
  }, book trim ${bookSize.label}, spread layout: ${spreadLayoutLabel}, aspect ratio ${
    settings.aspectRatio
  }, output size ${
    settings.imageSize
  }, negative prompt: ${image.effectiveNegativePrompt}`;
};

const buildImageSteps = (
  state: BuilderState,
  plan: StoryPlan,
  image: ImagePlan,
  settings: ImageSettings,
  finalStory: FinalStorySnapshot | null,
): ImageStep[] => {
  const spreadCount = Math.max(6, Math.min(16, state.spreads));
  const steps: ImageStep[] = [
    {
      id: "cover",
      label: "Book cover",
      kind: "cover",
      prompt: image.coverPrompt,
    },
  ];

  if (finalStory?.pages?.length) {
    finalStory.pages.slice(0, spreadCount).forEach((pageText, index) => {
      steps.push({
        id: `page-${index + 1}`,
        label: `Page ${index + 1}`,
        kind: "page",
        prompt: buildPagePrompt(pageText, index, state, plan, image, settings),
        pageIndex: index,
      });
    });
  }

  return steps;
};

const stripCodeFence = (value: string) => {
  const match = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (match ? match[1] : value).trim();
};

const extractJsonBlock = (value: string) => {
  const cleaned = stripCodeFence(value);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return cleaned.slice(start, end + 1).trim();
};

const extractResponseText = (payload: unknown) => {
  if (typeof payload === "string") {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return "";
  }

  const data = payload as Record<string, unknown>;
  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  const output = data.output;
  const chunks: string[] = [];

  if (Array.isArray(output)) {
    for (const item of output) {
      if (!item) continue;
      if (typeof item === "string") {
        chunks.push(item);
        continue;
      }

      if (typeof (item as { text?: unknown }).text === "string") {
        chunks.push((item as { text: string }).text);
      }

      const content = (item as { content?: unknown }).content;
      if (Array.isArray(content)) {
        for (const part of content) {
          if (!part || typeof part !== "object") continue;
          const text = (part as { text?: unknown }).text;
          if (typeof text === "string") {
            chunks.push(text);
            continue;
          }
          const outputText = (part as { output_text?: unknown }).output_text;
          if (typeof outputText === "string") {
            chunks.push(outputText);
          }
        }
      }
    }
  }

  if (chunks.length > 0) {
    return chunks.join("\n\n");
  }

  const choices = data.choices;
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      if (!choice || typeof choice !== "object") continue;
      const message = (choice as { message?: unknown }).message;
      if (message && typeof message === "object") {
        const content = (message as { content?: unknown }).content;
        if (typeof content === "string") {
          return content;
        }
      }
      const text = (choice as { text?: unknown }).text;
      if (typeof text === "string") {
        return text;
      }
    }
  }

  return JSON.stringify(payload, null, 2);
};

const parseStoryPlanFromText = (text: string, fallback: StoryPlan) => {
  const json = extractJsonBlock(text);
  if (!json) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }

  const palette = Array.isArray(parsed.palette)
    ? parsed.palette.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];
  const storyBeats = Array.isArray(parsed.storyBeats)
    ? parsed.storyBeats.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];
  const illustrationNotes = Array.isArray(parsed.illustrationNotes)
    ? parsed.illustrationNotes.filter(
        (item) => typeof item === "string" && item.trim().length > 0,
      )
    : [];

  return {
    title:
      typeof parsed.title === "string" && parsed.title.trim().length > 0
        ? parsed.title
        : fallback.title,
    metadataLine:
      typeof parsed.metadataLine === "string" && parsed.metadataLine.trim().length > 0
        ? parsed.metadataLine
        : fallback.metadataLine,
    synopsis:
      typeof parsed.synopsis === "string" && parsed.synopsis.trim().length > 0
        ? parsed.synopsis
        : fallback.synopsis,
    openingLine:
      typeof parsed.openingLine === "string" && parsed.openingLine.trim().length > 0
        ? parsed.openingLine
        : fallback.openingLine,
    coverPrompt:
      typeof parsed.coverPrompt === "string" && parsed.coverPrompt.trim().length > 0
        ? parsed.coverPrompt
        : fallback.coverPrompt,
    palette: palette.length > 0 ? palette : fallback.palette,
    storyBeats: storyBeats.length > 0 ? storyBeats : fallback.storyBeats,
    illustrationNotes: illustrationNotes.length > 0 ? illustrationNotes : fallback.illustrationNotes,
  };
};

const parseFinalStoryFromText = (text: string, fallback: FinalStorySnapshot) => {
  const json = extractJsonBlock(text);
  if (!json) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }

  const pages = Array.isArray(parsed.pages)
    ? parsed.pages.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];

  return {
    title:
      typeof parsed.title === "string" && parsed.title.trim().length > 0
        ? parsed.title
        : fallback.title,
    subtitle:
      typeof parsed.subtitle === "string" && parsed.subtitle.trim().length > 0
        ? parsed.subtitle
        : fallback.subtitle,
    pages: pages.length > 0 ? pages : fallback.pages,
  };
};

const extractOpenAiErrorMessage = (payload: unknown): string | null => {
  if (typeof payload === "string") {
    const parsed = safeParseJson<unknown>(payload, null);
    if (parsed) return extractOpenAiErrorMessage(parsed);
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const data = payload as { error?: unknown };
  if (typeof data.error === "string") return data.error;
  if (data.error && typeof data.error === "object") {
    const errorObj = data.error as { message?: unknown };
    if (typeof errorObj.message === "string") return errorObj.message;
  }
  return null;
};

const extractImageUrl = (payload: unknown) => {
  if (typeof payload === "string") {
    const parsed = safeParseJson<unknown>(payload, null);
    if (parsed) return extractImageUrl(parsed);
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data) || !data[0]) return null;
  const entry = data[0] as { url?: unknown; b64_json?: unknown };
  if (typeof entry.url === "string") {
    return entry.url;
  }
  if (typeof entry.b64_json === "string") {
    return `data:image/png;base64,${entry.b64_json}`;
  }
  return null;
};

const buildDraftPrompt = (state: BuilderState, plan: StoryPlan) => {
  const extraCharacters = (state.additionalCharacters ?? [])
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  const castList = [state.protagonist.trim(), state.sidekick.trim(), ...extraCharacters].filter(
    (value) => value.length > 0,
  );
  const castLine = formatCastList(castList);
  const spreadCount = Math.max(6, Math.min(16, state.spreads));

  return [
    "You are a children's story planner.",
    "Return JSON only with these keys: title, metadataLine, synopsis, openingLine, coverPrompt, palette, storyBeats, illustrationNotes.",
    "palette must be 3-5 hex colors. storyBeats must be 5 items. illustrationNotes must be 4-6 items.",
    `Age band: ${state.ageBand}`,
    `Language: ${state.language}`,
    `Genre: ${state.genre}`,
    `Mood: ${state.mood}`,
    `Narrative style: ${state.narrativeStyle}`,
    `Ending type: ${state.endingType}`,
    `Conflict type: ${state.conflictType}`,
    `Setting: ${state.setting}`,
    `Theme / lesson: ${state.themeLesson}`,
    `Core idea: ${state.theme}`,
    `Characters: ${castLine}`,
    `Illustration style: ${state.artStyle}`,
    `Illustration consistency: ${state.illustrationConsistency}`,
    `Safety constraints: ${state.safetyConstraints}`,
    `Spreads: ${spreadCount}`,
    `Draft context: ${plan.synopsis}`,
    "Respond with JSON only. No markdown.",
  ].join("\n");
};

const buildFinalPrompt = (state: BuilderState, plan: StoryPlan) => {
  const spreadCount = Math.max(6, Math.min(16, state.spreads));
  const beats = plan.storyBeats.map((beat, index) => `${index + 1}. ${beat}`).join(" ");
  const extraCharacters = (state.additionalCharacters ?? [])
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  return [
    "Write the final story in full.",
    "Return JSON only with keys: title, subtitle, pages.",
    `pages must be an array of ${spreadCount} strings (one per page/spread).`,
    `Age band: ${state.ageBand}`,
    `Language: ${state.language}`,
    `Narrative style: ${state.narrativeStyle}`,
    `Genre: ${state.genre}`,
    `Mood: ${state.mood}`,
    `Setting: ${state.setting}`,
    `Theme / lesson: ${state.themeLesson}`,
    `Characters: ${state.protagonist}, ${state.sidekick}${
      extraCharacters.length > 0 ? `, ${extraCharacters.join(", ")}` : ""
    }`,
    `Safety constraints: ${state.safetyConstraints}`,
    `Story beats: ${beats}`,
    "Keep the tone safe and warm for children.",
    "Respond with JSON only. No markdown.",
  ].join("\n");
};

const toOpenAiImageSize = (ratioLabel: string) => {
  const normalized = ratioLabel.toLowerCase();
  if (normalized.includes("landscape") || normalized.includes("cinematic")) {
    return "1792x1024";
  }
  if (normalized.includes("portrait") || normalized.includes("cover")) {
    return "1024x1792";
  }
  return "1024x1024";
};

const createStoryId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `story-${Date.now()}`;
};

const buildFinalStory = (state: BuilderState, story: StoryPlan): FinalStorySnapshot => {
  const spreadCount = Math.max(6, Math.min(16, state.spreads));
  const pages: string[] = [];
  const opening = story.openingLine.trim();
  const beats = story.storyBeats.map((beat) => beat.trim()).filter((beat) => beat.length > 0);
  const lesson = state.themeLesson.trim();

  for (let index = 0; index < spreadCount; index += 1) {
    if (index === 0 && opening) {
      pages.push(opening);
      continue;
    }

    if (index === spreadCount - 1 && lesson) {
      pages.push(`The story closes with a reminder about ${lesson.toLowerCase()}.`);
      continue;
    }

    const beat = beats[(index - 1) % beats.length] ?? "A gentle moment shifts the story.";
    pages.push(beat);
  }

  return {
    title: story.title,
    subtitle: story.metadataLine,
    pages,
  };
};

const App = () => {
  const initialColorMode = getInitialColorMode();
  const [authMode, setAuthMode] = createSignal<AuthMode>("login");
  const [authUsername, setAuthUsername] = createSignal("");
  const [authPassword, setAuthPassword] = createSignal("");
  const [authBusy, setAuthBusy] = createSignal(false);
  const [authError, setAuthError] = createSignal<string | null>(null);
  const [authUser, setAuthUser] = createSignal<string | null>(null);
  const [builder, setBuilder] = createSignal(initialState);
  const [imageSettings, setImageSettings] = createSignal(initialImageSettings);
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [isGeneratingImages, setIsGeneratingImages] = createSignal(false);
  const [isFinalGenerating, setIsFinalGenerating] = createSignal(false);
  const [hasGenerated, setHasGenerated] = createSignal(false);
  const [hasGeneratedImages, setHasGeneratedImages] = createSignal(false);
  const [hasFinalGenerated, setHasFinalGenerated] = createSignal(false);
  const [draftResponseText, setDraftResponseText] = createSignal<string | null>(null);
  const [draftError, setDraftError] = createSignal<string | null>(null);
  const [draftValidationOpen, setDraftValidationOpen] = createSignal(false);
  const [draftValidationActive, setDraftValidationActive] = createSignal(false);
  const [finalError, setFinalError] = createSignal<string | null>(null);
  const [imageError, setImageError] = createSignal<string | null>(null);
  const [generatedStoryPlan, setGeneratedStoryPlan] = createSignal<StoryPlan | null>(null);
  const [imageStepResults, setImageStepResults] = createSignal<
    Record<string, ImageStepResult>
  >({});
  const [activeImageStepIndex, setActiveImageStepIndex] = createSignal(0);
  const [isAcceptingImage, setIsAcceptingImage] = createSignal(false);
  const [acceptError, setAcceptError] = createSignal<string | null>(null);
  const [imageModalOpen, setImageModalOpen] = createSignal(false);
  const [imageModalIndex, setImageModalIndex] = createSignal(0);
  const [imageModalItems, setImageModalItems] = createSignal<ImageModalItem[]>([]);
  const [isSaving, setIsSaving] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = createSignal<string | null>(null);
  const [lastSavedAtRaw, setLastSavedAtRaw] = createSignal<string | null>(null);
  const [savePulse, setSavePulse] = createSignal(false);
  const [relativeTimeTick, setRelativeTimeTick] = createSignal(0);
  const [hasTouched, setHasTouched] = createSignal(false);
  const [isPublished, setIsPublished] = createSignal(false);
  const [readyOverride, setReadyOverride] = createSignal<boolean | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = createSignal(false);
  const [activeStoryId, setActiveStoryId] = createSignal<string | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = createSignal<string | null>(null);
  const [lastImagesGeneratedAt, setLastImagesGeneratedAt] = createSignal<string | null>(null);
  const [lastFinalGeneratedAt, setLastFinalGeneratedAt] = createSignal<string | null>(
    null,
  );
  const [finalStory, setFinalStory] = createSignal<FinalStorySnapshot | null>(null);
  const [finalPageIndex, setFinalPageIndex] = createSignal(0);
  const [colorMode, setColorMode] = createSignal<ColorMode>(initialColorMode);
  const [activeTab, setActiveTab] = createSignal<WorkspaceTab>("request");
  const [activeWorkspace, setActiveWorkspace] =
    createSignal<WorkspaceView>(getInitialWorkspace());
  const [selectedStoryId, setSelectedStoryId] = createSignal<string | null>(null);
  const storyDeskPageSize = 8;
  const [storyDeskQuery, setStoryDeskQuery] = createSignal("");
  const [storyDeskArchives, setStoryDeskArchives] = createSignal<StoryDeskEntry[]>([]);
  const [storyDeskPage, setStoryDeskPage] = createSignal(0);
  const [storyDeskHasMore, setStoryDeskHasMore] = createSignal(true);
  const [storyDeskLoading, setStoryDeskLoading] = createSignal(false);
  const [storyDeskError, setStoryDeskError] = createSignal<string | null>(null);
  const [storyDeskScrollEl, setStoryDeskScrollEl] = createSignal<HTMLDivElement | null>(
    null,
  );
  const [storyDeskSentinel, setStoryDeskSentinel] = createSignal<HTMLDivElement | null>(
    null,
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = createSignal(false);
  const [deleteTarget, setDeleteTarget] = createSignal<StoryDeskEntry | null>(null);
  const [deleteBusy, setDeleteBusy] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal<string | null>(null);
  const [unsavedConfirmOpen, setUnsavedConfirmOpen] = createSignal(false);
  const [unsavedBusy, setUnsavedBusy] = createSignal(false);
  const [pendingWorkspace, setPendingWorkspace] = createSignal<WorkspaceView | null>(null);
  const [pendingStory, setPendingStory] = createSignal<StoryDeskEntry | null>(null);
  const [routeStoryId, setRouteStoryId] = createSignal<string | null>(null);
  const [routeTargetTab, setRouteTargetTab] = createSignal<WorkspaceTab | null>(null);
  const [routeTargetView, setRouteTargetView] = createSignal<WorkspaceView | null>(null);
  const [storyDeskFilter, setStoryDeskFilter] = createSignal<
    "all" | "draft" | "review" | "ready" | "published"
  >("all");
  const [finalFontScale, setFinalFontScale] = createSignal(1);
  const [readAloudMode, setReadAloudMode] = createSignal(false);

  let autosaveTimer: number | undefined;
  let lastSavedSnapshot = "";
  let pendingSnapshot = "";
  let lastFetchedImagesStoryId: string | null = null;
  let routeInitialized = false;
  let isApplyingRoute = false;
  let lastRouteUrl = "";

  applyColorMode(initialColorMode);

  createEffect(() => {
    if (typeof window === "undefined") return;
    const storedUser = window.localStorage.getItem("mary-ann-stories-user");
    if (storedUser) {
      setAuthUser(storedUser);
    }
  });

  createEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("mary-ann-stories-workspace", activeWorkspace());
  });

  const baseStoryPlan = createMemo(() => buildStoryPlan(builder()));
  const storyPlan = createMemo(() => generatedStoryPlan() ?? baseStoryPlan());
  const imagePlan = createMemo(() =>
    buildImagePlan(builder(), storyPlan(), imageSettings()),
  );
  const imageSteps = createMemo(() =>
    buildImageSteps(builder(), storyPlan(), imagePlan(), imageSettings(), finalStory()),
  );
  const activeImageStep = createMemo(() => {
    const steps = imageSteps();
    if (steps.length === 0) return null;
    return steps[Math.min(activeImageStepIndex(), steps.length - 1)]!;
  });
  const activeImageResult = createMemo(() => {
    const step = activeImageStep();
    if (!step) return null;
    return imageStepResults()[step.id] ?? { status: "idle" as const };
  });
  const activeImageUrl = createMemo(() => {
    const result = activeImageResult();
    return result?.storedUrl ?? result?.imageUrl ?? null;
  });
  const isImageStepUnlocked = (index: number) => {
    if (index <= 0) return true;
    const steps = imageSteps();
    const results = imageStepResults();
    const previous = steps[index - 1];
    if (!previous) return false;
    const previousResult = results[previous.id];
    if (previousResult?.status === "saved") return true;
    return Boolean(previousResult?.storedUrl ?? previousResult?.imageUrl);
  };
  const readyForPublish = createMemo(() => {
    const override = readyOverride();
    if (override !== null) return override;
    if (!hasFinalGenerated()) return false;
    const steps = imageSteps();
    if (steps.length === 0) return false;
    const results = imageStepResults();
    return steps.every((step) => results[step.id]?.status === "saved");
  });
  const imageProgress = createMemo(() => {
    const steps = imageSteps();
    const results = imageStepResults();
    const coverSteps = steps.filter((step) => step.kind === "cover");
    const pageSteps = steps.filter((step) => step.kind === "page");
    const coverSaved = coverSteps.filter((step) => results[step.id]?.status === "saved");
    const pagesSaved = pageSteps.filter((step) => results[step.id]?.status === "saved");
    const totalSaved = steps.filter((step) => results[step.id]?.status === "saved");
    const percent = steps.length === 0 ? 0 : Math.round((totalSaved.length / steps.length) * 100);

    return {
      coverSaved: coverSaved.length,
      coverTotal: coverSteps.length,
      pagesSaved: pagesSaved.length,
      pagesTotal: pageSteps.length,
      totalSaved: totalSaved.length,
      total: steps.length,
      percent,
    };
  });
  const generatedGallery = createMemo<ImageModalItem[]>(() => {
    const steps = imageSteps();
    const results = imageStepResults();
    const settings = imageSettings();
    const bookSize = getBookSize(settings.bookSize);
    const spreadLayout = getSpreadLayoutLabel(settings.spreadLayout);

    return steps.flatMap((step) => {
      const result = results[step.id];
      const imageUrl = result?.storedUrl ?? result?.imageUrl;
      if (!imageUrl) return [];
      const kindLabel =
        step.kind === "cover" ? "Cover" : `Page ${(step.pageIndex ?? 0) + 1}`;
      const sourceLabel = result?.storedUrl ? "Saved to library" : "Generated";
      return [
        {
          id: step.id,
          title: step.label,
          subtitle: kindLabel,
          imageUrl,
          source: "generated",
          prompt: step.prompt,
          meta: [
            { label: "Type", value: kindLabel },
            { label: "Status", value: result?.status ?? "Generated" },
            { label: "Book size", value: bookSize.shortLabel },
            { label: "Spread layout", value: spreadLayout },
            { label: "Aspect ratio", value: settings.aspectRatio },
            { label: "Output size", value: settings.imageSize },
            { label: "Source", value: sourceLabel },
            {
              label: "Generated",
              value: result?.generatedAt ?? lastImagesGeneratedAt() ?? "—",
            },
          ],
        },
      ];
    });
  });
  const activeModalItem = createMemo(() => {
    const items = imageModalItems();
    if (items.length === 0) return null;
    const index = Math.min(Math.max(imageModalIndex(), 0), items.length - 1);
    return items[index] ?? null;
  });

  createEffect(() => {
    const steps = imageSteps();
    if (steps.length === 0) return;
    if (activeImageStepIndex() > steps.length - 1) {
      setActiveImageStepIndex(steps.length - 1);
    }
  });

  createEffect(() => {
    const step = activeImageStep();
    if (!step) {
      setHasGeneratedImages(false);
      return;
    }
    const result = imageStepResults()[step.id];
    setHasGeneratedImages(result?.status === "generated" || result?.status === "saved");
  });
  const saveStatus = createMemo(() => {
    if (isSaving()) {
      return { tone: "saving", text: "Saving..." };
    }
    if (saveError()) {
      return { tone: "error", text: saveError() ?? "Save failed" };
    }
    if (lastSavedAtRaw()) {
      return {
        tone: "saved",
        text: `Saved ${formatRelativeTime(lastSavedAtRaw()!, relativeTimeTick())}`,
      };
    }
    if (lastSavedAt()) {
      return { tone: "saved", text: `Saved ${lastSavedAt()}` };
    }
    return null;
  });

  createEffect(() => {
    if (typeof window === "undefined" || !lastSavedAtRaw()) return;
    const interval = window.setInterval(() => {
      setRelativeTimeTick((tick) => tick + 1);
    }, 30000);
    onCleanup(() => window.clearInterval(interval));
  });

  const storyDeskEntries = createMemo<StoryDeskEntry[]>(() => storyDeskArchives());
  const storyDeskCounts = createMemo(() => {
    const counts = {
      draft: 0,
      review: 0,
      ready: 0,
      published: 0,
    };
    for (const item of storyDeskEntries()) {
      if (item.statusTone === "published") {
        counts.published += 1;
        continue;
      }
      if (item.statusTone === "ready") {
        counts.ready += 1;
        continue;
      }
      if (item.statusTone === "review" || item.statusTone === "illustration") {
        counts.review += 1;
        continue;
      }
      counts.draft += 1;
    }
    return counts;
  });
  const filteredStoryDeskEntries = createMemo(() => {
    const query = storyDeskQuery().trim().toLowerCase();
    const filter = storyDeskFilter();
    let entries = storyDeskEntries();
    if (filter !== "all") {
      entries = entries.filter((item) => {
        if (filter === "draft") return item.statusTone === "draft";
        if (filter === "review") {
          return item.statusTone === "review" || item.statusTone === "illustration";
        }
        if (filter === "ready") return item.statusTone === "ready";
        if (filter === "published") return item.statusTone === "published";
        return true;
      });
    }
    if (!query) return entries;
    return entries.filter((item) => {
      if (item.title.toLowerCase().includes(query)) return true;
      if (item.summary.toLowerCase().includes(query)) return true;
      return item.tags.some((tag) => tag.toLowerCase().includes(query));
    });
  });
  const activeStory = createMemo<StoryDeskEntry | null>(() => {
    const entries = storyDeskEntries();
    if (entries.length === 0) return null;
    const selected = selectedStoryId();
    if (selected) {
      return entries.find((item) => item.id === selected) ?? entries[0]!;
    }
    return entries[0]!;
  });
  const buildStoryDeskEntryFromState = (
    id: string,
    updatedAtRaw: string,
  ): StoryDeskEntry => {
    const plan = storyPlan();
    const state = builder();
    const imageState = imageSettings();
    const ready = readyForPublish();
    const published = isPublished();
    const baseStatus = hasFinalGenerated()
      ? "illustration"
      : hasGenerated()
        ? "review"
        : "draft";
    const statusInfo = resolveStoryStatus(baseStatus, ready, published);

    return {
      id,
      status: statusInfo.label,
      statusTone: statusInfo.tone,
      title: plan.title,
      updatedAt: formatTimestamp(updatedAtRaw),
      updatedAtRaw,
      summary: plan.synopsis,
      openingLine: plan.openingLine,
      prompt: state.theme,
      beats: plan.storyBeats,
      tags: buildStoryTags(state),
      meta: buildStoryMeta(state, imageState, ready, published),
      builderSnapshot: cloneBuilder(state),
      imageSettingsSnapshot: cloneImageSettings(imageState),
      planSnapshot: plan,
      finalStorySnapshot: finalStory(),
      draftResponseText: draftResponseText(),
      imageResultsSnapshot: { ...imageStepResults() },
      ready,
      published,
      generatedAt: lastGeneratedAt() ?? null,
    };
  };
  const upsertStoryDeskEntry = (entry: StoryDeskEntry) => {
    setStoryDeskArchives((items) => [
      entry,
      ...items.filter((item) => item.id !== entry.id),
    ]);
  };
  const removeStoryDeskEntry = (id: string) => {
    setStoryDeskArchives((items) => items.filter((item) => item.id !== id));
  };

  const openStudio = () => {
    if (activeWorkspace() === "studio") {
      setActiveTab("request");
      return;
    }
    if (hasTouched()) {
      setPendingWorkspace("studio");
      setPendingStory(null);
      setUnsavedConfirmOpen(true);
      return;
    }
    setActiveWorkspace("studio");
    setActiveTab("request");
  };

  const requestWorkspaceSwitch = (target: WorkspaceView) => {
    if (activeWorkspace() === target) return;
    if (hasTouched()) {
      setPendingWorkspace(target);
      setPendingStory(null);
      setUnsavedConfirmOpen(true);
      return;
    }
    setActiveWorkspace(target);
  };

  const requestStoryOpen = (entry: StoryDeskEntry) => {
    if (hasTouched()) {
      setPendingStory(entry);
      setPendingWorkspace(null);
      setUnsavedConfirmOpen(true);
      return;
    }
    openStoryDeskEntry(entry);
  };

  const clearPendingAction = () => {
    setPendingWorkspace(null);
    setPendingStory(null);
  };

  const proceedPendingAction = () => {
    const story = pendingStory();
    const workspace = pendingWorkspace();
    clearPendingAction();
    if (story) {
      openStoryDeskEntry(story);
      return;
    }
    if (workspace) {
      setActiveWorkspace(workspace);
      if (workspace === "studio") {
        setActiveTab("request");
      }
    }
  };

  const cancelUnsavedConfirm = () => {
    setUnsavedConfirmOpen(false);
    setUnsavedBusy(false);
    clearPendingAction();
  };

  const discardUnsavedChanges = () => {
    if (!pendingStory()) {
      const candidateId = activeStoryId() ?? selectedStoryId();
      const entry = storyDeskEntries().find((item) => item.id === candidateId);
      if (entry) {
        applyStoryDeskEntry(entry, { activateWorkspace: false });
      } else {
        resetStudioState({ preserveSelection: true, preserveTab: true });
      }
    }
    setHasTouched(false);
    setUnsavedConfirmOpen(false);
    setUnsavedBusy(false);
    proceedPendingAction();
  };

  const saveAndContinue = async () => {
    if (unsavedBusy()) return;
    setUnsavedBusy(true);
    const success = await saveStory();
    if (success) {
      setUnsavedConfirmOpen(false);
      proceedPendingAction();
    }
    setUnsavedBusy(false);
  };

  const applyStoryDeskEntry = (
    entry: StoryDeskEntry,
    options?: { activateWorkspace?: boolean; tab?: WorkspaceTab },
  ) => {
    setSelectedStoryId(entry.id);
    setBuilder(cloneBuilder(entry.builderSnapshot));
    setImageSettings(cloneImageSettings(entry.imageSettingsSnapshot));
    setIsPublished(entry.published);
    setReadyOverride(entry.ready);
    setHasTouched(false);

    const fallbackPlan = buildStoryPlan(entry.builderSnapshot);
    const storedDraftText = entry.draftResponseText ?? null;
    const parsedDraftPlan = storedDraftText
      ? parseStoryPlanFromText(storedDraftText, fallbackPlan)
      : null;
    const hasDraft =
      Boolean(storedDraftText) ||
      entry.statusTone !== "draft" ||
      Boolean(entry.finalStorySnapshot);
    if (hasDraft) {
      setGeneratedStoryPlan(parsedDraftPlan ?? entry.planSnapshot);
      setHasGenerated(true);
      setLastGeneratedAt(entry.generatedAt ?? entry.updatedAt);
    } else {
      setGeneratedStoryPlan(null);
      setHasGenerated(false);
      setLastGeneratedAt(null);
    }

    setDraftResponseText(storedDraftText);
    setDraftError(null);
    setFinalError(null);

    if (entry.finalStorySnapshot) {
      setFinalStory(entry.finalStorySnapshot);
      setHasFinalGenerated(true);
      setLastFinalGeneratedAt(entry.updatedAt);
    } else {
      setFinalStory(null);
      setHasFinalGenerated(false);
      setLastFinalGeneratedAt(null);
    }
    setFinalPageIndex(0);

    setImageStepResults(entry.imageResultsSnapshot ?? {});
    setActiveImageStepIndex(0);
    setHasGeneratedImages(false);
    setLastImagesGeneratedAt(null);
    setImageError(null);
    setAcceptError(null);

    setIsGeneratingImages(false);
    setIsFinalGenerating(false);
    setActiveStoryId(entry.id);
    void fetchStoryImages(entry.id);
    setLastSavedAt(entry.updatedAt);
    setLastSavedAtRaw(entry.updatedAtRaw ?? null);
    setSavePulse(false);

    if (options?.activateWorkspace ?? true) {
      setActiveWorkspace("studio");
      setActiveTab(options?.tab ?? "output");
    }
  };

  const openStoryDeskEntry = (entry: StoryDeskEntry) => {
    applyStoryDeskEntry(entry, { activateWorkspace: true, tab: "output" });
  };

  const applyRouteState = (route: RouteState) => {
    if (route.view) {
      setActiveWorkspace(route.view);
    }

    if (route.view === "studio") {
      if (route.tab) {
        setActiveTab(route.tab);
      } else if (route.story) {
        setActiveTab("output");
      }
    }

    if (route.story) {
      setSelectedStoryId(route.story);
      setRouteStoryId(route.story);
      setRouteTargetTab(route.tab ?? (route.view === "studio" ? "output" : null));
      setRouteTargetView(route.view);
    }
  };

  createEffect(() => {
    if (typeof window === "undefined") return;
    if (routeInitialized) return;
    routeInitialized = true;
    const route = readRouteState();
    if (!route) return;
    isApplyingRoute = true;
    applyRouteState(route);
    isApplyingRoute = false;
    lastRouteUrl = `${window.location.pathname}${window.location.search}`;
  });

  createEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => {
      const route = readRouteState();
      if (!route) return;
      isApplyingRoute = true;
      applyRouteState(route);
      isApplyingRoute = false;
      lastRouteUrl = `${window.location.pathname}${window.location.search}`;
    };
    window.addEventListener("popstate", handlePopState);
    onCleanup(() => window.removeEventListener("popstate", handlePopState));
  });

  createEffect(() => {
    if (typeof window === "undefined") return;
    if (isApplyingRoute) return;
    const view = activeWorkspace();
    const tab = view === "studio" ? activeTab() : undefined;
    const story = view === "studio" ? activeStoryId() : null;
    const nextUrl = buildRouteUrl({ view, tab, story });
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (!lastRouteUrl) {
      lastRouteUrl = currentUrl;
      if (nextUrl !== currentUrl) {
        window.history.replaceState({}, "", nextUrl);
        lastRouteUrl = nextUrl;
      }
      return;
    }
    if (nextUrl === currentUrl) {
      lastRouteUrl = nextUrl;
      return;
    }
    window.history.pushState({}, "", nextUrl);
    lastRouteUrl = nextUrl;
  });

  const fetchStoryDeskPage = async (page: number, mode: "append" | "replace") => {
    const user = authUser();
    if (!user) return;
    if (storyDeskLoading()) return;
    setStoryDeskLoading(true);
    setStoryDeskError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/stories/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user,
          page,
          page_size: storyDeskPageSize,
        }),
      });

      const data = (await response.json().catch(() => null)) as StoryListResponse | null;
      if (!response.ok) {
        setStoryDeskError((data as { error?: string } | null)?.error ?? "Unable to load stories.");
        setStoryDeskHasMore(false);
        return;
      }

      const entries = Array.isArray(data?.stories)
        ? data.stories.map(buildStoryDeskEntryFromRecord)
        : [];
      setStoryDeskArchives((items) =>
        mode === "append" ? [...items, ...entries] : entries,
      );
      setStoryDeskPage(page);
      setStoryDeskHasMore(Boolean(data?.has_more));
    } catch (err) {
      setStoryDeskError("Network error. Please try again.");
    } finally {
      setStoryDeskLoading(false);
    }
  };

  const fetchStoryImages = async (storyId: string) => {
    if (!storyId) return;
    try {
      const response = await fetch(`${apiBaseUrl}/api/images/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story_id: storyId }),
      });
      const data = (await response.json().catch(() => null)) as
        | ImageListResponse
        | { error?: string }
        | null;
      if (!response.ok) {
        if (activeTab() === "images") {
          setImageError(data?.error ?? "Unable to load saved images.");
        }
        lastFetchedImagesStoryId = null;
        return;
      }
      const images = Array.isArray(data?.images) ? data.images : [];
      lastFetchedImagesStoryId = storyId;
      if (images.length === 0) return;
      const savedResults = mapSavedImagesToResults(images);
      if (Object.keys(savedResults).length === 0) return;
      setImageStepResults((current) => ({ ...current, ...savedResults }));
    } catch (err) {
      if (activeTab() === "images") {
        setImageError("Unable to load saved images.");
      }
      lastFetchedImagesStoryId = null;
    }
  };

  createEffect(() => {
    const storyId = activeStoryId();
    if (!storyId || activeTab() !== "images") return;
    if (
      lastFetchedImagesStoryId === storyId &&
      Object.keys(imageStepResults()).length > 0
    ) {
      return;
    }
    void fetchStoryImages(storyId);
  });

  const requestDeleteStory = (entry: StoryDeskEntry) => {
    setDeleteError(null);
    setDeleteTarget(entry);
    setDeleteConfirmOpen(true);
  };

  const cancelDeleteStory = () => {
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const handleDeleteStory = async () => {
    const target = deleteTarget();
    const user = authUser();
    if (!target || !user) {
      cancelDeleteStory();
      return;
    }

    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/stories/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: target.id, username: user }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setDeleteError(data?.error ?? "Unable to delete story.");
        return;
      }

      removeStoryDeskEntry(target.id);
      if (selectedStoryId() === target.id) {
        setSelectedStoryId(null);
      }
      if (activeStoryId() === target.id) {
        setActiveStoryId(null);
        setLastSavedAt(null);
        setLastSavedAtRaw(null);
        setSavePulse(false);
        setIsPublished(false);
      }
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError("Network error. Please try again.");
    } finally {
      setDeleteBusy(false);
    }
  };

  createEffect(() => {
    const user = authUser();
    if (!user) {
      setStoryDeskArchives([]);
      setStoryDeskPage(0);
      setStoryDeskHasMore(true);
      setStoryDeskError(null);
      setSelectedStoryId(null);
      return;
    }
    void fetchStoryDeskPage(0, "replace");
  });

  createEffect(() => {
    const entries = storyDeskEntries();
    const selected = selectedStoryId();
    if (entries.length === 0) {
      if (selected !== null && !routeStoryId()) {
        setSelectedStoryId(null);
      }
      return;
    }
    if (routeStoryId()) {
      return;
    }
    if (!selected || !entries.some((item) => item.id === selected)) {
      setSelectedStoryId(entries[0]!.id);
    }
  });

  createEffect(() => {
    if (activeWorkspace() !== "studio") return;
    if (hasTouched()) return;
    const selected = selectedStoryId();
    if (!selected) return;
    if (activeStoryId() === selected) return;
    const entry = storyDeskEntries().find((item) => item.id === selected);
    if (!entry) return;
    applyStoryDeskEntry(entry, { activateWorkspace: false, tab: activeTab() });
  });

  createEffect(() => {
    if (hasTouched()) return;
    const storyId = activeStoryId();
    if (!storyId) return;
    const entry = storyDeskEntries().find((item) => item.id === storyId);
    if (!entry || !entry.imageResultsSnapshot) return;
    const snapshot = entry.imageResultsSnapshot;
    if (Object.keys(snapshot).length === 0) return;
    const current = imageStepResults();
    const differs = Object.keys(snapshot).some((key) => {
      const currentEntry = current[key];
      const nextEntry = snapshot[key];
      if (!currentEntry) return true;
      return (
        currentEntry.status !== nextEntry.status ||
        currentEntry.imageUrl !== nextEntry.imageUrl ||
        currentEntry.storedUrl !== nextEntry.storedUrl
      );
    });
    if (differs || Object.keys(current).length === 0) {
      setImageStepResults(snapshot);
    }
  });

  createEffect(() => {
    const storyId = routeStoryId();
    if (!storyId) return;
    const entry = storyDeskEntries().find((item) => item.id === storyId);
    if (!entry) return;
    const targetView = routeTargetView() ?? activeWorkspace();
    const targetTab = routeTargetTab() ?? "output";
    setRouteStoryId(null);
    setRouteTargetTab(null);
    setRouteTargetView(null);
    if (targetView === "studio") {
      if (hasTouched()) {
        setPendingStory(entry);
        setPendingWorkspace(null);
        setUnsavedConfirmOpen(true);
        return;
      }
      applyStoryDeskEntry(entry, { activateWorkspace: true, tab: targetTab });
      return;
    }
    setSelectedStoryId(entry.id);
  });

  const openImageModal = (items: ImageModalItem[], startIndex: number) => {
    if (items.length === 0) return;
    const safeIndex = Math.min(Math.max(startIndex, 0), items.length - 1);
    setImageModalItems(items);
    setImageModalIndex(safeIndex);
    setImageModalOpen(true);
  };

  const closeImageModal = () => {
    setImageModalOpen(false);
  };

  const goModalPrev = () => {
    const items = imageModalItems();
    if (items.length === 0) return;
    setImageModalIndex((index) => (index - 1 + items.length) % items.length);
  };

  const goModalNext = () => {
    const items = imageModalItems();
    if (items.length === 0) return;
    setImageModalIndex((index) => (index + 1) % items.length);
  };

  const openGeneratedModal = () => {
    const gallery = generatedGallery();
    if (gallery.length === 0) return;
    const stepId = activeImageStep()?.id;
    const startIndex = gallery.findIndex((item) => item.id === stepId);
    openImageModal(gallery, startIndex >= 0 ? startIndex : 0);
  };

  createEffect(() => {
    if (!imageModalOpen() || typeof window === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeImageModal();
      }
      if (event.key === "ArrowLeft") {
        goModalPrev();
      }
      if (event.key === "ArrowRight") {
        goModalNext();
      }
    };
    window.addEventListener("keydown", handleKeydown);
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeydown);
      document.body.style.overflow = previousOverflow;
    });
  });

  createEffect(() => {
    if (!resetConfirmOpen() || typeof window === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancelReset();
      }
    };
    window.addEventListener("keydown", handleKeydown);
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeydown);
      document.body.style.overflow = previousOverflow;
    });
  });

  createEffect(() => {
    if (!deleteConfirmOpen() || typeof window === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancelDeleteStory();
      }
    };
    window.addEventListener("keydown", handleKeydown);
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeydown);
      document.body.style.overflow = previousOverflow;
    });
  });

  createEffect(() => {
    if (!unsavedConfirmOpen() || typeof window === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancelUnsavedConfirm();
      }
    };
    window.addEventListener("keydown", handleKeydown);
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeydown);
      document.body.style.overflow = previousOverflow;
    });
  });

  createEffect(() => {
    if (!draftValidationOpen() || typeof window === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDraftValidation();
      }
    };
    window.addEventListener("keydown", handleKeydown);
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeydown);
      document.body.style.overflow = previousOverflow;
    });
  });

  const loadMoreStoryDesk = () => {
    if (storyDeskLoading() || !storyDeskHasMore() || storyDeskQuery().trim()) {
      return;
    }
    const nextPage = storyDeskPage() + 1;
    void fetchStoryDeskPage(nextPage, "append");
  };

  createEffect(() => {
    const rootEl = storyDeskScrollEl();
    const sentinel = storyDeskSentinel();
    if (!rootEl || !sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreStoryDesk();
        }
      },
      { root: rootEl, rootMargin: "120px 0px" },
    );
    observer.observe(sentinel);
    onCleanup(() => observer.disconnect());
  });

  const requestState = createMemo(() => {
    if (isGeneratingImages()) {
      return "Images running";
    }

    if (isGenerating()) {
      return "Story running";
    }

    if (isFinalGenerating()) {
      return "Final running";
    }

    if (activeTab() === "images" && hasGeneratedImages()) {
      return "Images ready";
    }

    if (hasFinalGenerated()) {
      return "Final ready";
    }

    if (hasGenerated()) {
      return "Story ready";
    }

    return "Idle";
  });

  const requestStateTone = createMemo(() => {
    if (isGenerating() || isGeneratingImages() || isFinalGenerating()) {
      return "running";
    }

    if (hasGenerated() || hasGeneratedImages() || hasFinalGenerated()) {
      return "ready";
    }

    return "idle";
  });

  const summaryCards = createMemo(() => [
    { label: "Workspace state", value: requestState() },
    { label: "Story run", value: lastGeneratedAt() ?? "Not run" },
    { label: "Image run", value: lastImagesGeneratedAt() ?? "Not run" },
    { label: "Language", value: builder().language },
    { label: "Setting", value: builder().setting },
    {
      label: "Image package",
      value: `${getBookSize(imageSettings().bookSize).shortLabel} / ${imageSettings().aspectRatio} / ${imageSettings().variationCount} vars`,
    },
  ]);

  const outputDetails = createMemo(() => [
    { label: "Metadata", value: storyPlan().metadataLine },
    { label: "Theme / lesson", value: builder().themeLesson },
    { label: "Narrative style", value: builder().narrativeStyle },
    { label: "Ending type", value: builder().endingType },
    { label: "Conflict type", value: builder().conflictType },
    { label: "Safety constraints", value: builder().safetyConstraints },
  ]);

  const outputChips = createMemo(() => [
    { label: "Setting", value: builder().setting },
    { label: "Lesson", value: builder().themeLesson },
    { label: "Narrative", value: builder().narrativeStyle },
    { label: "Ending", value: builder().endingType },
    { label: "Language", value: builder().language },
    { label: "Conflict", value: builder().conflictType },
  ]);

  const draftMissingFields = createMemo(() => {
    const state = builder();
    return draftRequiredFields.filter((field) => {
      const value = state[field.key];
      if (typeof value === "string") {
        return value.trim().length === 0;
      }
      if (typeof value === "number") {
        return Number.isNaN(value) || value <= 0;
      }
      return true;
    });
  });
  const isDraftReady = createMemo(() => draftMissingFields().length === 0);
  const isDraftFieldMissing = (key: DraftRequiredFieldKey) =>
    draftMissingFields().some((field) => field.key === key);
  const renderFieldLabel = (label: string, required: boolean) => (
    <span class="field-label-row">
      <span class="field-label">{label}</span>
      <span class={`field-tag ${required ? "required" : "optional"}`}>
        {required ? "Required" : "Optional"}
      </span>
    </span>
  );

  const imageMetaCards = createMemo(() => [
    { label: "Book size", value: getBookSize(imageSettings().bookSize).shortLabel },
    { label: "Aspect ratio", value: imageSettings().aspectRatio },
    { label: "Output size", value: imageSettings().imageSize },
    { label: "Variations", value: String(imageSettings().variationCount) },
    { label: "Cover focus", value: imageSettings().coverFocus },
    { label: "Spread layout", value: getSpreadLayoutLabel(imageSettings().spreadLayout) },
  ]);
  const activeBookSize = createMemo(() => getBookSize(imageSettings().bookSize));
  const activeSpreadLayout = createMemo(() =>
    spreadLayoutOptions.find((option) => option.id === imageSettings().spreadLayout),
  );

  const payloadPreview = createMemo(() => JSON.stringify(builder(), null, 2));

  createEffect(() => {
    const mode = colorMode();

    applyColorMode(mode);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("mary-ann-stories-color-mode", mode);
    }
  });

  const updateField = <K extends keyof BuilderState,>(
    field: K,
    value: BuilderState[K],
  ) => {
    setBuilder((current) => ({
      ...current,
      [field]: value,
    }));
    setHasTouched(true);
    setReadyOverride(null);
  };

  const addAdditionalCharacter = () => {
    setBuilder((current) => ({
      ...current,
      additionalCharacters: [...current.additionalCharacters, ""],
    }));
    setHasTouched(true);
    setReadyOverride(null);
  };

  const updateAdditionalCharacter = (index: number, value: string) => {
    setBuilder((current) => {
      const next = [...current.additionalCharacters];
      next[index] = value;
      return { ...current, additionalCharacters: next };
    });
    setHasTouched(true);
    setReadyOverride(null);
  };

  const removeAdditionalCharacter = (index: number) => {
    setBuilder((current) => {
      const next = current.additionalCharacters.filter((_, i) => i !== index);
      return { ...current, additionalCharacters: next };
    });
    setHasTouched(true);
    setReadyOverride(null);
  };

  const updateImageSetting = <K extends keyof ImageSettings,>(
    field: K,
    value: ImageSettings[K],
  ) => {
    setImageSettings((current) => ({
      ...current,
      [field]: value,
    }));
    setHasTouched(true);
    setReadyOverride(null);
  };

  const handleBookSizeChange = (value: string) => {
    const selected = getBookSize(value);
    setImageSettings((current) => ({
      ...current,
      bookSize: selected.id,
      aspectRatio: selected.aspectRatio,
      imageSize: selected.imageSize,
    }));
    setHasTouched(true);
    setReadyOverride(null);
  };

  const buildAutosaveSnapshot = () =>
    JSON.stringify({
      builder: builder(),
      imageSettings: imageSettings(),
      storyPlan: storyPlan(),
      finalStory: finalStory(),
      imageStepResults: imageStepResults(),
      hasGenerated: hasGenerated(),
      hasFinalGenerated: hasFinalGenerated(),
      draftResponseText: draftResponseText(),
      published: isPublished(),
    });

  const scheduleAutosave = (snapshot: string) => {
    if (typeof window === "undefined") return;
    if (autosaveTimer) {
      window.clearTimeout(autosaveTimer);
    }
    pendingSnapshot = snapshot;
    autosaveTimer = window.setTimeout(() => {
      void saveStory({ silent: true, snapshot: pendingSnapshot });
    }, 1200);
  };

  const ensureStoryId = () => {
    const existing = activeStoryId();
    if (existing) return existing;
    const next = createStoryId();
    setActiveStoryId(next);
    return next;
  };

  const buildStoryPayload = (id: string) => {
    const plan = storyPlan();
    const state = builder();
    const ready = readyForPublish();
    const published = isPublished();
    const baseStatus = hasFinalGenerated()
      ? "illustration"
      : hasGenerated()
        ? "review"
        : "draft";
    const statusInfo = resolveStoryStatus(baseStatus, ready, published);

    return {
      id,
      username: authUser(),
      title: plan.title,
      summary: plan.synopsis,
      prompt: state.theme,
      status: statusInfo.value,
      ready,
      published,
      builder: state,
      image_settings: imageSettings(),
      story_plan: plan,
      final_story: finalStory(),
      draft_response_text: draftResponseText(),
      image_results: imageStepResults(),
    };
  };

  const saveStory = async (options?: { silent?: boolean; snapshot?: string }) => {
    const user = authUser();
    if (!user) {
      if (!options?.silent) {
        setSaveError("Sign in to save your work.");
      }
      return false;
    }
    if (isSaving()) return false;

    const id = ensureStoryId();
    const payload = buildStoryPayload(id);
    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/stories/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const rawText = await response.text();
      const parsed = safeParseJson<StoryUpsertResponse | { error?: string } | string>(
        rawText,
        rawText,
      );
      if (!response.ok) {
        setSaveError(
          resolveApiErrorMessage(response, parsed, rawText, "Unable to save."),
        );
        return false;
      }

      const data =
        parsed && typeof parsed === "object"
          ? (parsed as StoryUpsertResponse)
          : null;
      const updatedAtRaw = data?.updated_at ?? new Date().toISOString();
      setLastSavedAtRaw(updatedAtRaw);
      setLastSavedAt(formatTimestamp(updatedAtRaw));
      upsertStoryDeskEntry(buildStoryDeskEntryFromState(id, updatedAtRaw));
      setSelectedStoryId(id);
      setHasTouched(false);
      lastSavedSnapshot = options?.snapshot ?? buildAutosaveSnapshot();
      if (options?.silent) {
        setSavePulse(true);
        if (typeof window !== "undefined") {
          window.setTimeout(() => setSavePulse(false), 1400);
        }
      } else {
        setSavePulse(false);
      }
      return true;
    } catch (err) {
      setSaveError("Network error. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  createEffect(() => {
    if (!authUser() || !hasTouched()) return;
    const snapshot = buildAutosaveSnapshot();
    if (snapshot === lastSavedSnapshot) return;
    scheduleAutosave(snapshot);
  });

  createEffect(() => {
    if (draftValidationActive() && isDraftReady()) {
      setDraftValidationActive(false);
      setDraftValidationOpen(false);
    }
  });

  const resetStudioState = (options?: {
    preserveSelection?: boolean;
    preserveTab?: boolean;
  }) => {
    setBuilder(cloneBuilder(resetState));
    setImageSettings(cloneImageSettings(initialImageSettings));
    setHasGenerated(false);
    setHasGeneratedImages(false);
    setHasFinalGenerated(false);
    setIsGenerating(false);
    setIsGeneratingImages(false);
    setIsFinalGenerating(false);
    setDraftResponseText(null);
    setDraftError(null);
    setFinalError(null);
    setImageError(null);
    setGeneratedStoryPlan(null);
    setImageStepResults({});
    setActiveImageStepIndex(0);
    setIsAcceptingImage(false);
    setAcceptError(null);
    setActiveStoryId(null);
    setLastGeneratedAt(null);
    setLastImagesGeneratedAt(null);
    setLastFinalGeneratedAt(null);
    setFinalStory(null);
    setFinalPageIndex(0);
    setImageModalOpen(false);
    setImageModalItems([]);
    setImageModalIndex(0);
    setIsPublished(false);
    setReadyOverride(null);
    setHasTouched(false);
    setSaveError(null);
    setLastSavedAt(null);
    setLastSavedAtRaw(null);
    setSavePulse(false);
    setDraftValidationActive(false);
    setDraftValidationOpen(false);
    lastSavedSnapshot = "";

    if (!options?.preserveSelection) {
      setSelectedStoryId(null);
    }
    if (!options?.preserveTab) {
      setActiveTab("request");
    }
  };

  const requestReset = () => {
    setResetConfirmOpen(true);
  };

  const cancelReset = () => {
    setResetConfirmOpen(false);
  };

  const handleReset = () => {
    setResetConfirmOpen(false);
    resetStudioState();
  };

  const handleResetImages = () => {
    setImageSettings(cloneImageSettings(initialImageSettings));
    setHasGeneratedImages(false);
    setIsGeneratingImages(false);
    setImageError(null);
    setImageStepResults({});
    setActiveImageStepIndex(0);
    setAcceptError(null);
    setIsAcceptingImage(false);
    setLastImagesGeneratedAt(null);
    setHasTouched(true);
    setReadyOverride(null);
  };

  const openDraftValidation = () => {
    setDraftValidationActive(true);
    setDraftValidationOpen(true);
  };

  const closeDraftValidation = () => {
    setDraftValidationOpen(false);
  };

  const handleGenerate = async () => {
    if (isGenerating()) return;
    if (!isDraftReady()) {
      setActiveTab("request");
      openDraftValidation();
      return;
    }
    setIsGenerating(true);
    setDraftError(null);
    setDraftResponseText(null);
    setGeneratedStoryPlan(null);
    setHasGenerated(false);
    setHasFinalGenerated(false);
    setLastFinalGeneratedAt(null);
    setFinalStory(null);
    setFinalPageIndex(0);
    ensureStoryId();
    setReadyOverride(null);

    const fallbackPlan = baseStoryPlan();
    const prompt = buildDraftPrompt(builder(), fallbackPlan);

    try {
      const response = await fetch(`${apiBaseUrl}/api/story/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const rawText = await response.text();
      const parsed = safeParseJson<unknown>(rawText, rawText);
      if (!response.ok) {
        setDraftError(
          resolveApiErrorMessage(response, parsed, rawText, "Story generation failed."),
        );
        return;
      }

      const text = extractResponseText(parsed);
      setDraftResponseText(text);
      const parsedPlan = parseStoryPlanFromText(text, fallbackPlan);
      if (parsedPlan) {
        setGeneratedStoryPlan(parsedPlan);
      }

      setActiveImageStepIndex(0);
      setHasGeneratedImages(false);
      setLastImagesGeneratedAt(null);
      setImageError(null);
      setAcceptError(null);
      setHasGenerated(true);
      setLastGeneratedAt(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
      setHasTouched(true);
    } catch (err) {
      setDraftError("Network error. Please try again.");
    } finally {
      setIsGenerating(false);
      setActiveTab("output");
    }
  };

  const handleGenerateFinal = async () => {
    if (!hasGenerated() || isFinalGenerating()) return;
    setIsFinalGenerating(true);
    setFinalError(null);
    setHasFinalGenerated(false);
    setFinalStory(null);
    setFinalPageIndex(0);
    setReadyOverride(null);

    const plan = storyPlan();
    const prompt = buildFinalPrompt(builder(), plan);

    try {
      const response = await fetch(`${apiBaseUrl}/api/story/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const rawText = await response.text();
      const parsedPayload = safeParseJson<unknown>(rawText, rawText);
      if (!response.ok) {
        setFinalError(
          resolveApiErrorMessage(
            response,
            parsedPayload,
            rawText,
            "Final story generation failed.",
          ),
        );
        return;
      }

      const text = extractResponseText(parsedPayload);
      const fallback = buildFinalStory(builder(), plan);
      const parsedStory = parseFinalStoryFromText(text, fallback) ?? fallback;
      setFinalStory(parsedStory);
      setHasFinalGenerated(true);
      setLastFinalGeneratedAt(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
      setHasTouched(true);
    } catch (err) {
      setFinalError("Network error. Please try again.");
    } finally {
      setIsFinalGenerating(false);
      setFinalPageIndex(0);
      setActiveTab("final");
    }
  };

  const handleGenerateImages = async () => {
    if (isGeneratingImages()) return;
    setIsGeneratingImages(true);
    setImageError(null);
    setAcceptError(null);
    setHasGeneratedImages(false);
    setReadyOverride(null);

    const step = activeImageStep();
    if (!step) {
      setImageError("No image step is available yet.");
      setIsGeneratingImages(false);
      return;
    }
    if (!isImageStepUnlocked(activeImageStepIndex())) {
      setImageError("Finish the previous image before generating this one.");
      setIsGeneratingImages(false);
      return;
    }

    const prompt = step.prompt;
    const size = toOpenAiImageSize(imageSettings().aspectRatio);

    try {
      const response = await fetch(`${apiBaseUrl}/api/images/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size }),
      });

      const rawText = await response.text();
      const parsedPayload = safeParseJson<unknown>(rawText, rawText);
      if (!response.ok) {
        setImageError(
          resolveApiErrorMessage(
            response,
            parsedPayload,
            rawText,
            "Image generation failed.",
          ),
        );
        return;
      }

      const upstreamError = extractOpenAiErrorMessage(parsedPayload);
      if (upstreamError) {
        setImageError(upstreamError);
        return;
      }

      const imageUrl = extractImageUrl(parsedPayload);
      const generatedAt = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      if (imageUrl) {
        setImageStepResults((current) => ({
          ...current,
          [step.id]: {
            status: "generated",
            imageUrl,
            generatedAt,
          },
        }));
      } else {
        setImageError("Image response did not include a usable URL.");
      }

      setLastImagesGeneratedAt(generatedAt);
      setHasTouched(true);
    } catch (err) {
      setImageError("Network error. Please try again.");
    } finally {
      setIsGeneratingImages(false);
      setActiveTab("images");
    }
  };

  const handleAcceptImage = async () => {
    if (isAcceptingImage()) return;
    setAcceptError(null);

    const storyId = activeStoryId();
    const step = activeImageStep();
    const result = activeImageResult();
    const imageRef = result?.storedUrl ?? result?.imageUrl ?? null;
    if (!storyId) {
      setAcceptError("Run a draft first so we can attach images to a story.");
      return;
    }
    if (!step || !imageRef) {
      setAcceptError("Generate an image before accepting.");
      return;
    }

    setIsAcceptingImage(true);
    setReadyOverride(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/images/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          story_id: storyId,
          image: imageRef,
          prompt: step.prompt,
          kind: step.kind,
          page_index: step.pageIndex ?? null,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setAcceptError(data?.error ?? "Unable to store the image.");
        return;
      }

      const storedUrl = typeof data?.url === "string" ? data.url : null;
      setImageStepResults((current) => ({
        ...current,
        [step.id]: {
          status: "saved",
          imageUrl: result?.imageUrl ?? imageRef,
          storedUrl: storedUrl ?? imageRef,
          generatedAt: result?.generatedAt,
        },
      }));
      setHasTouched(true);
      void saveStory({ silent: true });

      if (activeImageStepIndex() < imageSteps().length - 1) {
        setActiveImageStepIndex(activeImageStepIndex() + 1);
        setHasGeneratedImages(false);
        setImageError(null);
        setAcceptError(null);
      }
    } catch (err) {
      setAcceptError("Network error. Please try again.");
    } finally {
      setIsAcceptingImage(false);
    }
  };

  const handleAuthSubmit = async (event: Event) => {
    event.preventDefault();
    setAuthError(null);

    const username = authUsername().trim();
    const password = authPassword();

    if (!username || !password) {
      setAuthError("Username and password are required.");
      return;
    }

    setAuthBusy(true);
    try {
      const endpoint =
        authMode() === "register" ? "/api/auth/register" : "/api/auth/login";
      const response = await fetch(`${apiBaseUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setAuthError(data.error ?? "Unable to authenticate.");
        return;
      }

      const resolvedName = data.user?.username ?? username;
      setAuthUser(resolvedName);
      setAuthPassword("");
      if (typeof window !== "undefined") {
        window.localStorage.setItem("mary-ann-stories-user", resolvedName);
      }
    } catch (err) {
      setAuthError("Network error. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  };

  const toggleAuthMode = () => {
    setAuthError(null);
    setAuthMode((current) => (current === "login" ? "register" : "login"));
  };

  const handleLogout = () => {
    setAuthUser(null);
    setAuthUsername("");
    setAuthPassword("");
    setAuthError(null);
    setAuthMode("login");
    setActiveStoryId(null);
    setIsPublished(false);
    setReadyOverride(null);
    setHasTouched(false);
    setLastSavedAt(null);
    setLastSavedAtRaw(null);
    setSavePulse(false);
    setSaveError(null);
    setDraftValidationActive(false);
    setDraftValidationOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("mary-ann-stories-user");
    }
  };

  return (
    <Show
      when={authUser()}
      fallback={
        <main class="login-shell">
          <section class="login-card">
            <div class="login-brand">
              <div class="app-logo-frame">
                <img class="app-logo" src={logoUrl} alt="Mary Ann Stories logo" />
              </div>
              <div class="login-brand-copy">
                <p class="section-label">Mary Ann Stories</p>
                <h1>{authMode() === "login" ? "Welcome back." : "Create your workspace."}</h1>
                <p class="subtle-text">
                  Sign in to continue shaping story worlds, character arcs, and
                  illustration-ready prompts.
                </p>
                <div class="login-note">
                  <span>Tip</span>
                  <p>
                    Use a short username and a memorable password. You can
                    create multiple test accounts while we build out the real
                    auth flow.
                  </p>
                </div>
              </div>
            </div>

            <form class="login-form" onSubmit={handleAuthSubmit}>
              <div>
                <p class="section-label">
                  {authMode() === "login" ? "Sign in" : "Create account"}
                </p>
                <h2>
                  {authMode() === "login"
                    ? "Story console access"
                    : "Start your story console"}
                </h2>
                <p class="subtle-text">
                  {authMode() === "login"
                    ? "Use your credentials to load the builder workspace."
                    : "Pick a username to save your progress in Postgres."}
                </p>
              </div>

              <label class="login-field">
                <span>Username</span>
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  placeholder="your-name"
                  value={authUsername()}
                  onInput={(event) => setAuthUsername(event.currentTarget.value)}
                />
              </label>

              <label class="login-field">
                <span>Password</span>
                <input
                  type="password"
                  name="password"
                  autoComplete={
                    authMode() === "login" ? "current-password" : "new-password"
                  }
                  placeholder="••••••••"
                  value={authPassword()}
                  onInput={(event) => setAuthPassword(event.currentTarget.value)}
                />
              </label>

              <Show when={authError()}>
                <div class="login-error">{authError()}</div>
              </Show>

              <button class="button primary login-submit" type="submit" disabled={authBusy()}>
                {authBusy()
                  ? "Working..."
                  : authMode() === "login"
                    ? "Sign in"
                    : "Create account"}
              </button>

              <button
                class="button ghost login-toggle"
                type="button"
                onClick={toggleAuthMode}
              >
                {authMode() === "login"
                  ? "Need an account? Create one"
                  : "Already have an account? Sign in"}
              </button>
            </form>
          </section>
        </main>
      }
    >
      <main class="page-shell">
      <section class={`app-header ${activeWorkspace() === "home" ? "home" : "studio"}`}>
        <div class="title-block">
          <div class="app-brand">
            <div class="app-logo-frame">
              <img class="app-logo" src={logoUrl} alt="Mary Ann Stories logo" />
            </div>
            <div>
              <p class="section-label">Mary Ann Stories</p>
              <h1>
                {activeWorkspace() === "home" ? "Story desk" : "Studio"}
              </h1>
            </div>
          </div>
          <p class="subtle-text">
            {activeWorkspace() === "home"
              ? "Review recent drafts, resume work, and head into production when you are ready."
              : "Build the request in one tab, then inspect the draft output and payload separately so the parameter surface can stay wide."}
          </p>
          <div class="app-nav" role="tablist" aria-label="Workspace views">
            <button
              class={`nav-pill ${activeWorkspace() === "home" ? "active" : ""}`}
              type="button"
              role="tab"
              aria-selected={activeWorkspace() === "home"}
              onClick={() => requestWorkspaceSwitch("home")}
            >
              Story desk
            </button>
            <button
              class={`nav-pill ${activeWorkspace() === "studio" ? "active" : ""}`}
              type="button"
              role="tab"
              aria-selected={activeWorkspace() === "studio"}
              onClick={openStudio}
            >
              Studio
            </button>
          </div>
          <div class="user-strip">
            <div class="user-pill">
              <span class="user-pill-label">Signed in</span>
              <strong>{authUser()}</strong>
            </div>
            <button class="logout-pill" type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>

        <div class="header-actions">
          <div class="theme-switcher" role="group" aria-label="Theme">
            <span class="theme-switcher-label">Theme</span>
            <div class="theme-switcher-track">
              <button
                class={`theme-option ${colorMode() === "light" ? "active" : ""}`}
                type="button"
                aria-pressed={colorMode() === "light"}
                onClick={() => setColorMode("light")}
              >
                Light
              </button>
              <button
                class={`theme-option ${colorMode() === "dark" ? "active" : ""}`}
                type="button"
                aria-pressed={colorMode() === "dark"}
                onClick={() => setColorMode("dark")}
              >
                Dark
              </button>
            </div>
          </div>
          <Show
            when={activeWorkspace() === "studio"}
            fallback={
              <button
                class="button primary"
                type="button"
                onClick={openStudio}
              >
                Open studio
              </button>
            }
          >
            <div class={`status-badge ${requestStateTone()}`}>{requestState()}</div>
            <Show when={saveStatus()}>
              {(note) => (
                <span
                  class={`save-indicator ${note().tone} ${
                    savePulse() && note().tone === "saved" ? "pulse" : ""
                  }`}
                >
                  {note().text}
                </span>
              )}
            </Show>
            <button
              class="button ghost"
              type="button"
              onClick={() => saveStory()}
              disabled={isSaving()}
            >
              {isSaving() ? "Saving..." : "Save draft"}
            </button>
            <button
              class="button primary"
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating()}
            >
              {isGenerating() ? "Running..." : "Run draft"}
            </button>
            <button class="button ghost" type="button" onClick={requestReset}>
              Reset
            </button>
          </Show>
        </div>
      </section>

      <Show when={activeWorkspace() === "home"}>
        <section class="story-desk" aria-label="Story desk">
          <aside class="story-desk-rail">
            <div class="story-desk-header">
              <div>
                <p class="section-label">Story desk</p>
                <h2>Recent drafts</h2>
                <p class="subtle-text">
                  Re-open work, scan progress, and keep the next story queued up.
                </p>
              </div>
              <label class="story-desk-search">
                <span class="story-desk-search-label">Search</span>
                <input
                  type="search"
                  placeholder="Find a story..."
                  value={storyDeskQuery()}
                  onInput={(event) => setStoryDeskQuery(event.currentTarget.value)}
                />
              </label>
              <div class="story-desk-filters">
                <span class="story-desk-filter-label">Filter</span>
                <div class="story-desk-filter-chips">
                  <button
                    class={`filter-chip ${storyDeskFilter() === "all" ? "active" : ""}`}
                    type="button"
                    onClick={() => setStoryDeskFilter("all")}
                  >
                    All
                    <span class="filter-count">{storyDeskEntries().length}</span>
                  </button>
                  <button
                    class={`filter-chip ${storyDeskFilter() === "draft" ? "active" : ""}`}
                    type="button"
                    onClick={() => setStoryDeskFilter("draft")}
                  >
                    Draft
                    <span class="filter-count">{storyDeskCounts().draft}</span>
                  </button>
                  <button
                    class={`filter-chip ${storyDeskFilter() === "review" ? "active" : ""}`}
                    type="button"
                    onClick={() => setStoryDeskFilter("review")}
                  >
                    Review
                    <span class="filter-count">{storyDeskCounts().review}</span>
                  </button>
                  <button
                    class={`filter-chip ${storyDeskFilter() === "ready" ? "active" : ""}`}
                    type="button"
                    onClick={() => setStoryDeskFilter("ready")}
                  >
                    Ready
                    <span class="filter-count">{storyDeskCounts().ready}</span>
                  </button>
                  <button
                    class={`filter-chip ${storyDeskFilter() === "published" ? "active" : ""}`}
                    type="button"
                    onClick={() => setStoryDeskFilter("published")}
                  >
                    Published
                    <span class="filter-count">{storyDeskCounts().published}</span>
                  </button>
                </div>
              </div>
            </div>
            <div class="story-list" ref={setStoryDeskScrollEl}>
              <Show
                when={filteredStoryDeskEntries().length > 0}
                fallback={
                  <div class="story-list-empty">
                    <p>
                      {storyDeskError()
                        ? storyDeskError()
                        : storyDeskQuery().trim()
                          ? "No matches yet. Try another keyword."
                          : storyDeskFilter() !== "all"
                            ? "No stories match this status filter yet."
                            : "No stories yet. Start in the studio to save your first draft."}
                    </p>
                    <Show
                      when={
                        !storyDeskError() &&
                        !storyDeskQuery().trim() &&
                        storyDeskFilter() === "all"
                      }
                    >
                      <button class="button primary" type="button" onClick={openStudio}>
                        Start first draft
                      </button>
                    </Show>
                  </div>
                }
              >
                <For each={filteredStoryDeskEntries()}>
                  {(item) => (
                  <button
                    class={`story-card-mini ${selectedStoryId() === item.id ? "active" : ""}`}
                    type="button"
                    onClick={() => requestStoryOpen(item)}
                  >
                      <div class="story-card-mini-top">
                        <span class={`story-status ${item.statusTone}`}>{item.status}</span>
                        <span class="story-time">{item.updatedAt}</span>
                      </div>
                      <strong>{item.title}</strong>
                      <p>{item.summary}</p>
                      <div class="story-tags">
                        <For each={item.tags}>{(tag) => <span>{tag}</span>}</For>
                      </div>
                    </button>
                  )}
                </For>
              </Show>
              <Show when={!storyDeskQuery().trim() && !storyDeskError()}>
                <Show
                  when={storyDeskHasMore()}
                  fallback={<div class="story-list-end">Start of your archive.</div>}
                >
                  <div
                    class={`story-list-sentinel ${storyDeskLoading() ? "loading" : ""}`}
                    ref={setStoryDeskSentinel}
                  >
                    {storyDeskLoading()
                      ? "Loading older drafts..."
                      : "Scroll for older drafts"}
                  </div>
                </Show>
              </Show>
            </div>
          </aside>

          <div class="story-desk-main">
            <Show
              when={activeStory()}
              fallback={
                <article class="panel story-spotlight story-empty">
                  <div class="panel-header">
                    <p class="panel-kicker">Story desk</p>
                    <h2>No stories yet</h2>
                  </div>
                  <p class="story-spotlight-summary">
                    Start a new draft in the studio to build your first story entry.
                  </p>
                  <button class="button primary" type="button" onClick={openStudio}>
                    Start drafting
                  </button>
                </article>
              }
            >
              {(story) => (
                <article class="panel story-spotlight">
                  <div class="panel-header">
                    <p class="panel-kicker">Story desk</p>
                    <h2>{story().title}</h2>
                    <div class="story-spotlight-meta">
                      <span class={`story-status ${story().statusTone}`}>
                        {story().status}
                      </span>
                      <span class="story-time">{story().updatedAt}</span>
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
              when={activeStory()}
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
                      <h3>Next steps</h3>
                    </div>
                    <div class="story-actions-grid">
                      <button
                        class="button ghost"
                        type="button"
                        onClick={() => requestStoryOpen(story())}
                      >
                        Open in studio
                      </button>
                      <button
                        class="button ghost danger"
                        type="button"
                        onClick={() => requestDeleteStory(story())}
                      >
                        Delete story
                      </button>
                    </div>
                  </article>
                </>
              )}
            </Show>
          </aside>
        </section>
      </Show>

      <Show when={activeWorkspace() === "studio"}>
        <section class="summary-grid">
          <For each={summaryCards()}>
            {(item) => (
              <article class="summary-card">
                <span class="summary-label">{item.label}</span>
                <strong class="summary-value">{item.value}</strong>
              </article>
            )}
          </For>
        </section>

        <section class="workspace-tabs" role="tablist" aria-label="Workspace tabs">
          <For each={workspaceTabs}>
            {(tab) => (
              <button
                class={`tab-button ${activeTab() === tab.id ? "active" : ""}`}
                type="button"
                role="tab"
                aria-selected={activeTab() === tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                <span class="tab-label">{tab.label}</span>
                <span class="tab-note">{tab.note}</span>
              </button>
            )}
          </For>
        </section>

      <Show when={activeTab() === "request"}>
        <section class="request-grid" role="tabpanel" aria-label="Story parameters">
          <div class="request-group request-group-story">
            <div class="request-group-header">
              <div>
                <p class="section-label">Story</p>
                <h3>Core story blocks</h3>
              </div>
              <span class="request-group-meta">Build the cast, setting, and pacing.</span>
            </div>
            <div class="request-group-grid">
              <article class="panel request-block request-block-wide request-composite">
                <div class="request-block-header">
                  <p class="panel-kicker">Story setup</p>
                  <h2>Cast and pacing</h2>
                </div>

                <div class="request-split-grid">
                  <section class="request-subsection">
                    <p class="request-subsection-title">Characters</p>

                    <div class="field-grid field-grid-3">
                      <label
                        class={`field ${
                          draftValidationActive() && isDraftFieldMissing("protagonist")
                            ? "invalid"
                            : ""
                        }`}
                      >
                        {renderFieldLabel("Protagonist", true)}
                        <input
                          type="text"
                          value={builder().protagonist}
                          onInput={(event) =>
                            updateField("protagonist", event.currentTarget.value)
                          }
                        />
                      </label>

                      <label
                        class={`field ${
                          draftValidationActive() && isDraftFieldMissing("sidekick")
                            ? "invalid"
                            : ""
                        }`}
                      >
                        {renderFieldLabel("Sidekick", false)}
                        <input
                          type="text"
                          value={builder().sidekick}
                          onInput={(event) =>
                            updateField("sidekick", event.currentTarget.value)
                          }
                        />
                      </label>

                      <label
                        class={`field ${
                          draftValidationActive() && isDraftFieldMissing("protagonistTrait")
                            ? "invalid"
                            : ""
                        }`}
                      >
                        {renderFieldLabel("Trait / flaw", false)}
                        <input
                          type="text"
                          placeholder="Shy but observant"
                          value={builder().protagonistTrait}
                          onInput={(event) =>
                            updateField("protagonistTrait", event.currentTarget.value)
                          }
                        />
                      </label>
                    </div>

                    <div class="character-extended">
                      <div class="character-extended-header">
                        <p class="detail-label">Additional characters</p>
                        <button
                          class="button ghost character-add"
                          type="button"
                          onClick={addAdditionalCharacter}
                        >
                          Add character
                        </button>
                      </div>
                      <Show
                        when={builder().additionalCharacters.length > 0}
                        fallback={
                          <p class="subtle-text">
                            Add supporting cast like mentors, rivals, guardians, or friends.
                          </p>
                        }
                      >
                        <div class="character-list">
                          <For each={builder().additionalCharacters}>
                            {(name, index) => (
                              <div class="character-row">
                                <input
                                  type="text"
                                  placeholder="Character name or role"
                                  value={name}
                                  onInput={(event) =>
                                    updateAdditionalCharacter(
                                      index(),
                                      event.currentTarget.value,
                                    )
                                  }
                                />
                                <button
                                  class="character-remove"
                                  type="button"
                                  onClick={() => removeAdditionalCharacter(index())}
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  </section>

                  <section class="request-subsection">
                    <p class="request-subsection-title">Story controls</p>

                    <div class="field-grid field-grid-3">
                      <label class="field">
                        {renderFieldLabel("Age band", true)}
                        <select
                          value={builder().ageBand}
                          onInput={(event) => updateField("ageBand", event.currentTarget.value)}
                        >
                          <For each={ageBands}>
                            {(item) => <option value={item}>{item}</option>}
                          </For>
                        </select>
                      </label>

                      <label class="field">
                        {renderFieldLabel("Genre", true)}
                        <select
                          value={builder().genre}
                          onInput={(event) => updateField("genre", event.currentTarget.value)}
                        >
                          <For each={genres}>{(item) => <option value={item}>{item}</option>}</For>
                        </select>
                      </label>

                      <label class="field">
                        {renderFieldLabel("Mood", true)}
                        <select
                          value={builder().mood}
                          onInput={(event) => updateField("mood", event.currentTarget.value)}
                        >
                          <For each={moods}>{(item) => <option value={item}>{item}</option>}</For>
                        </select>
                      </label>
                    </div>

                    <div class="field-grid">
                      <label class="field">
                        {renderFieldLabel("Narrative style", true)}
                        <select
                          value={builder().narrativeStyle}
                          onInput={(event) =>
                            updateField("narrativeStyle", event.currentTarget.value)
                          }
                        >
                          <For each={narrativeStyles}>
                            {(item) => <option value={item}>{item}</option>}
                          </For>
                        </select>
                      </label>

                      <label class="field">
                        {renderFieldLabel("Ending type", true)}
                        <select
                          value={builder().endingType}
                          onInput={(event) => updateField("endingType", event.currentTarget.value)}
                        >
                          <For each={endingTypes}>
                            {(item) => <option value={item}>{item}</option>}
                          </For>
                        </select>
                      </label>
                    </div>

                  <label class="field">
                    <div class="range-header">
                      {renderFieldLabel("Spreads", true)}
                      <strong>{builder().spreads}</strong>
                    </div>
                      <input
                        type="range"
                        min="6"
                        max="16"
                        step="2"
                        value={builder().spreads}
                        onInput={(event) =>
                          updateField("spreads", Number(event.currentTarget.value))
                        }
                      />
                    </label>
                  </section>
                </div>
              </article>

              <article class="panel request-block request-block-wide">
                <div class="request-block-header">
                  <p class="panel-kicker">Core concept</p>
                  <h2>Premise and direction</h2>
                </div>

                <label
                  class={`field ${
                    draftValidationActive() && isDraftFieldMissing("theme") ? "invalid" : ""
                  }`}
                >
                  {renderFieldLabel("Prompt", true)}
                  <textarea
                    rows={4}
                    value={builder().theme}
                    onInput={(event) => updateField("theme", event.currentTarget.value)}
                  />
                </label>

                <div class="field-grid field-grid-3">
                  <label
                    class={`field ${
                      draftValidationActive() && isDraftFieldMissing("setting") ? "invalid" : ""
                    }`}
                  >
                    {renderFieldLabel("Setting / world", true)}
                    <input
                      type="text"
                      placeholder="Cloud village, school library, night market..."
                      value={builder().setting}
                      onInput={(event) => updateField("setting", event.currentTarget.value)}
                    />
                  </label>

                  <label
                    class={`field ${
                      draftValidationActive() && isDraftFieldMissing("themeLesson")
                        ? "invalid"
                        : ""
                    }`}
                  >
                    {renderFieldLabel("Theme / lesson", true)}
                    <input
                      type="text"
                      placeholder="Kindness, confidence, curiosity..."
                      value={builder().themeLesson}
                      onInput={(event) => updateField("themeLesson", event.currentTarget.value)}
                    />
                  </label>

                  <label class="field">
                    {renderFieldLabel("Language / locale", false)}
                    <select
                      value={builder().language}
                      onInput={(event) => updateField("language", event.currentTarget.value)}
                    >
                      <For each={languages}>
                        {(item) => <option value={item}>{item}</option>}
                      </For>
                    </select>
                  </label>
                </div>
              </article>

              <article class="panel request-block request-block-wide">
                <div class="request-block-header">
                  <p class="panel-kicker">Format</p>
                  <h2>Book size and spread layout</h2>
                </div>

                <div class="image-settings">
                  <div class="image-settings-grid">
                    <label class="field">
                      {renderFieldLabel("Book size", false)}
                      <select
                        value={imageSettings().bookSize}
                        onInput={(event) => handleBookSizeChange(event.currentTarget.value)}
                      >
                        <For each={bookSizes}>
                          {(size) => <option value={size.id}>{size.label}</option>}
                        </For>
                      </select>
                    </label>
                    <label class="field">
                      {renderFieldLabel("Spread layout", false)}
                      <select
                        value={imageSettings().spreadLayout}
                        onInput={(event) =>
                          updateImageSetting(
                            "spreadLayout",
                            event.currentTarget.value as SpreadLayout,
                          )
                        }
                      >
                        <For each={spreadLayoutOptions}>
                          {(option) => <option value={option.id}>{option.label}</option>}
                        </For>
                      </select>
                      <span class="field-help">
                        {activeSpreadLayout()?.note ??
                          "Choose how the art flows across the spread."}
                      </span>
                    </label>
                  </div>

                  <div class="book-preview">
                    <div
                      class="book-preview-frame"
                      style={{
                        "aspect-ratio": `${activeBookSize().width} / ${activeBookSize().height}`,
                      }}
                    >
                      <span>{activeBookSize().shortLabel}</span>
                    </div>
                    <div class="book-preview-meta">
                      <div>
                        <p class="detail-label">Aspect ratio</p>
                        <strong>{imageSettings().aspectRatio}</strong>
                      </div>
                      <div>
                        <p class="detail-label">Output size</p>
                        <strong>{imageSettings().imageSize}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>

          <div class="request-group request-group-execution">
            <div class="request-group-header">
              <div>
                <p class="section-label">Execution</p>
                <h3>Visual direction and run</h3>
              </div>
              <span class="request-group-meta">
                Tune style, guardrails, and launch the draft.
              </span>
            </div>
            <div class="request-group-grid">
          <article class="panel request-block request-advanced-block">
            <div class="request-block-header">
              <p class="panel-kicker">Advanced</p>
              <h2>Visual direction</h2>
            </div>

            <div class="field-grid">
              <label class="field">
                {renderFieldLabel("Conflict type", false)}
                <select
                  value={builder().conflictType}
                  onInput={(event) => updateField("conflictType", event.currentTarget.value)}
                >
                  <For each={conflictTypes}>
                    {(item) => <option value={item}>{item}</option>}
                  </For>
                </select>
              </label>

              <label class="field">
                {renderFieldLabel("Illustration style", false)}
                <select
                  value={builder().artStyle}
                  onInput={(event) => updateField("artStyle", event.currentTarget.value)}
                >
                  <For each={artStyles}>{(item) => <option value={item}>{item}</option>}</For>
                </select>
              </label>
            </div>

            <label class="field">
              {renderFieldLabel("Illustration consistency notes", false)}
              <textarea
                rows={3}
                value={builder().illustrationConsistency}
                onInput={(event) =>
                  updateField("illustrationConsistency", event.currentTarget.value)
                }
              />
            </label>
          </article>

          <article class="panel request-block request-actions-block">
            <div class="request-block-header">
              <p class="panel-kicker">Execution</p>
              <h2>Guardrails and run</h2>
            </div>

            <label class="field request-actions-textarea">
              {renderFieldLabel("Safety / exclusions", false)}
              <textarea
                rows={6}
                value={builder().safetyConstraints}
                onInput={(event) =>
                  updateField("safetyConstraints", event.currentTarget.value)
                }
              />
            </label>

            <div class="request-footer-copy request-footer-copy-compact">
              <p class="footer-note">
                The output tab uses the current form state. Running the draft stamps
                the request time and switches to the output tab automatically.
              </p>
            </div>
            <Show when={draftMissingFields().length > 0}>
              <div class="panel-note panel-note-inline">
                Fill in{" "}
                {draftMissingFields()
                  .map((field) => field.label)
                  .join(", ")}{" "}
                to run a draft.
              </div>
            </Show>

            <div class="form-actions request-actions-row">
              <button
                class="button primary"
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating()}
              >
                {isGenerating() ? "Running..." : "Run draft"}
              </button>
              <button class="button ghost" type="button" onClick={requestReset}>
                Reset form
              </button>
            </div>
          </article>
            </div>
          </div>
        </section>
      </Show>

      <Show when={activeTab() === "output"}>
        <section class="output-stack" role="tabpanel" aria-label="Generated output">
          <div class="panel preview">
            <div class="panel-header">
              <p class="panel-kicker">Output</p>
              <h2>Draft preview</h2>
            </div>

            <Show
              when={hasGenerated() && generatedStoryPlan()}
              fallback={
                <div class="panel-note panel-note-inline">
                  {hasGenerated()
                    ? "Draft response is ready. Structured preview will appear once parsing succeeds."
                    : "Run draft to generate a preview of the story plan."}
                </div>
              }
            >
              {(plan) => (
                <>
                  <div class="profile-grid">
                    <For each={outputChips()}>
                      {(item) => (
                        <div class="profile-chip">
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </div>
                      )}
                    </For>
                  </div>

                  <div class="preview-grid">
                    <article class="cover-card">
                      <p class="section-label">Generated title</p>
                      <h3>{plan().title}</h3>
                      <p class="cover-meta">{plan().metadataLine}</p>
                      <div class="swatch-row">
                        <For each={plan().palette}>
                          {(color) => (
                            <span class="swatch" style={{ "background-color": color }} />
                          )}
                        </For>
                      </div>
                    </article>

                    <article class="text-panel">
                      <div>
                        <p class="detail-label">Synopsis</p>
                        <p class="detail-text">{plan().synopsis}</p>
                      </div>

                      <div>
                        <p class="detail-label">Opening line</p>
                        <p class="detail-text">{plan().openingLine}</p>
                      </div>
                    </article>
                  </div>

                  <div class="story-grid">
                    <article class="story-card">
                      <p class="detail-label">Story beats</p>
                      <For each={plan().storyBeats}>
                        {(beat, index) => (
                          <div class="list-item">
                            <span>{String(index() + 1).padStart(2, "0")}</span>
                            <p>{beat}</p>
                          </div>
                        )}
                      </For>
                    </article>

                    <article class="story-card">
                      <p class="detail-label">Illustration notes</p>
                      <For each={plan().illustrationNotes}>
                        {(note) => (
                          <div class="list-item tight">
                            <span>*</span>
                            <p>{note}</p>
                          </div>
                        )}
                      </For>

                      <div class="prompt-chip">
                        <strong>Cover prompt:</strong> {plan().coverPrompt}
                      </div>
                    </article>
                  </div>
                </>
              )}
            </Show>

            <Show when={hasGenerated()}>
              <div class="generated-banner">
                Preview generated at {lastGeneratedAt()}.
              </div>
              <div class="final-actions">
                <button
                  class="button primary"
                  type="button"
                  onClick={handleGenerateFinal}
                  disabled={isFinalGenerating()}
                >
                  {isFinalGenerating()
                    ? "Finalizing..."
                    : hasFinalGenerated()
                      ? "Re-run final"
                      : "Run final story"}
                </button>
                <Show when={hasFinalGenerated()}>
                  <span class="final-timestamp">
                    Final run at {lastFinalGeneratedAt()}.
                  </span>
                </Show>
              </div>
            </Show>
          </div>

          <Show when={hasGenerated()}>
            <div class="panel diagnostics">
              <div class="panel-header">
                <p class="panel-kicker">Diagnostics</p>
                <h2>Request details</h2>
              </div>

              <div class="diagnostic-grid">
                <div class="definition-list">
                  <For each={outputDetails()}>
                    {(item) => (
                      <div class="definition-item">
                        <span class="definition-term">{item.label}</span>
                        <span class="definition-value">{item.value}</span>
                      </div>
                    )}
                  </For>
                </div>

                <pre class="payload-block">{payloadPreview()}</pre>
              </div>
            </div>
          </Show>
        </section>
      </Show>

      <Show when={activeTab() === "images"}>
        <section class="image-workspace" role="tabpanel" aria-label="Image generation">
          <div class="panel image-panel">
            <div class="panel-header">
              <p class="panel-kicker">Images</p>
              <h2>Image queue</h2>
            </div>
            <div class="image-queue-header">
              <Show when={imageSteps().length > 0}>
                <>
                  <div class="image-step-list">
                    <For each={imageSteps()}>
                      {(step, index) => {
                        const result = imageStepResults()[step.id];
                        const status = result?.status ?? "idle";
                        const locked = !isImageStepUnlocked(index());
                        return (
                          <button
                            class={`image-step-chip ${index() === activeImageStepIndex() ? "active" : ""} ${status}`}
                            type="button"
                            onClick={() => {
                              setActiveImageStepIndex(index());
                              setImageError(null);
                              setAcceptError(null);
                            }}
                            disabled={locked}
                          >
                            <span>{step.label}</span>
                            <span class="image-step-status">
                              {status === "saved"
                                ? "Saved"
                                : status === "generated"
                                  ? "Ready"
                                  : "Queued"}
                            </span>
                          </button>
                        );
                      }}
                    </For>
                  </div>
                  <div class="image-progress">
                    <div class="image-progress-meta">
                      <span>
                        Cover {imageProgress().coverSaved}/{imageProgress().coverTotal}
                      </span>
                      <span>
                        {imageProgress().pagesTotal === 0
                          ? "Pages locked"
                          : `Pages ${imageProgress().pagesSaved}/${imageProgress().pagesTotal}`}
                      </span>
                      <span>
                        Total {imageProgress().totalSaved}/{imageProgress().total}
                      </span>
                    </div>
                    <div class="image-progress-bar">
                      <span
                        class="image-progress-fill"
                        style={{ width: `${imageProgress().percent}%` }}
                      />
                    </div>
                  </div>
                </>
              </Show>
              <Show when={!finalStory()}>
                <div class="panel-note panel-note-inline">
                  Run the final story to unlock per-page images. The cover can be generated
                  now.
                </div>
              </Show>
            </div>
            <div class="image-grid">
              <div class="image-controls">
                <div class="profile-grid">
                  <For each={imageMetaCards()}>
                    {(item) => (
                      <div class="profile-chip">
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    )}
                  </For>
                </div>

                <div class="prompt-chip">
                  <strong>{activeImageStep()?.label ?? "Image prompt"}:</strong>{" "}
                  {activeImageStep()?.prompt ?? "Run the final story to build prompts."}
                </div>

                <div class="form-actions">
                  <Show
                    when={hasGeneratedImages()}
                    fallback={
                      <button
                        class="button primary"
                        type="button"
                        onClick={handleGenerateImages}
                        disabled={isGeneratingImages()}
                      >
                        {isGeneratingImages() ? "Generating..." : "Run images"}
                      </button>
                    }
                  >
                    <button
                      class="button ghost"
                      type="button"
                      onClick={handleGenerateImages}
                      disabled={isGeneratingImages()}
                    >
                      {isGeneratingImages() ? "Regenerating..." : "Regenerate"}
                    </button>
                    <Show when={activeImageResult()?.status === "generated"}>
                      <button
                        class="button primary"
                        type="button"
                        onClick={handleAcceptImage}
                        disabled={isAcceptingImage()}
                      >
                        {isAcceptingImage() ? "Saving..." : "Accept & save"}
                      </button>
                    </Show>
                    <Show when={activeImageResult()?.status === "saved"}>
                      <span class="saved-pill">Saved</span>
                    </Show>
                  </Show>
                  <button class="button ghost" type="button" onClick={handleResetImages}>
                    Reset images
                  </button>
                </div>

                <Show when={imageError()}>
                  <div class="panel-note panel-note-inline">{imageError()}</div>
                </Show>

                <Show when={acceptError()}>
                  <div class="panel-note panel-note-inline">{acceptError()}</div>
                </Show>

                <Show when={lastImagesGeneratedAt()}>
                  <div class="generated-banner">
                    Images generated at {lastImagesGeneratedAt()}.
                  </div>
                </Show>

                <Show when={activeImageResult()?.status === "saved"}>
                  <div class="generated-banner">Image saved to story library.</div>
                </Show>
              </div>

              <div class="image-preview">
                <Show
                  when={activeImageUrl()}
                  fallback={
                    <div class="image-placeholder">
                      <p class="detail-label">Preview</p>
                      <p class="subtle-text">
                        Run the current image step to see the generated art. Once
                        images are ready, click the preview to open the full gallery.
                      </p>
                    </div>
                  }
                >
                  <button
                    class="image-frame image-frame-button"
                    type="button"
                    onClick={openGeneratedModal}
                  >
                    <img src={activeImageUrl()!} alt="Generated cover art" />
                  </button>
                </Show>
              </div>
            </div>
          </div>
        </section>
      </Show>

      <Show when={activeTab() === "final"}>
        <section class="final-story" role="tabpanel" aria-label="Final story output">
          <div class="panel final-story-panel">
            <div class="panel-header">
              <p class="panel-kicker">Final output</p>
              <h2>Final story</h2>
            </div>

            <Show
              when={finalStory()}
              fallback={
                finalError() ? (
                  <div class="panel-note panel-note-inline">{finalError()}</div>
                ) : (
                  <div class="panel-note panel-note-inline">
                    Run the final story from the Draft preview to generate the finalized
                    text here.
                  </div>
                )
              }
            >
              <div class="final-story-header">
                <h3>{finalStory()!.title}</h3>
                <p class="subtle-text">{finalStory()!.subtitle}</p>
              </div>
              <div class="final-story-toolbar">
                <div class="final-story-nav">
                  <button
                    class="final-nav-button"
                    type="button"
                    onClick={() =>
                      setFinalPageIndex((current) => Math.max(0, current - 1))
                    }
                    disabled={finalPageIndex() === 0}
                    aria-label="Previous page"
                  >
                    ◀
                  </button>
                  <span class="final-page-indicator">
                    Page {finalPageIndex() + 1} of {finalStory()!.pages.length}
                  </span>
                  <button
                    class="final-nav-button"
                    type="button"
                    onClick={() =>
                      setFinalPageIndex((current) =>
                        Math.min(finalStory()!.pages.length - 1, current + 1),
                      )
                    }
                    disabled={finalPageIndex() >= finalStory()!.pages.length - 1}
                    aria-label="Next page"
                  >
                    ▶
                  </button>
                </div>
                <div class="final-story-controls">
                  <label class="reader-toggle">
                    <input
                      type="checkbox"
                      checked={readAloudMode()}
                      onInput={(event) => setReadAloudMode(event.currentTarget.checked)}
                    />
                    <span>Read aloud spacing</span>
                  </label>
                  <label class="reader-slider">
                    <span>Font size</span>
                    <input
                      type="range"
                      min="0.9"
                      max="1.4"
                      step="0.05"
                      value={finalFontScale()}
                      onInput={(event) =>
                        setFinalFontScale(parseFloat(event.currentTarget.value))
                      }
                    />
                  </label>
                </div>
                <button
                  class="button ghost"
                  type="button"
                  onClick={() => setActiveTab("images")}
                >
                  Continue to images
                </button>
              </div>
              <div
                class="final-story-body"
                style={{
                  "--reader-scale": finalFontScale(),
                  "--reader-line": readAloudMode() ? 1.95 : 1.65,
                }}
              >
                <p class="final-story-paragraph">
                  {finalStory()!.pages[finalPageIndex()]}
                </p>
              </div>
              <Show when={lastFinalGeneratedAt()}>
                <div class="generated-banner">
                  Final story generated at {lastFinalGeneratedAt()}.
                </div>
              </Show>
            </Show>
          </div>
        </section>
      </Show>
      </Show>

      <Show when={imageModalOpen() ? activeModalItem() : null}>
        {(item) => (
          <div class="image-modal" role="dialog" aria-modal="true" onClick={closeImageModal}>
            <div
              class="image-modal-card"
              role="document"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                class="image-modal-close"
                type="button"
                onClick={closeImageModal}
                aria-label="Close image preview"
              >
                X
              </button>
              <div class="image-modal-preview">
                <img src={item().imageUrl} alt={item().title} />
                <button
                  class="image-modal-nav prev"
                  type="button"
                  onClick={goModalPrev}
                  aria-label="Previous image"
                  disabled={imageModalItems().length <= 1}
                >
                  ◀
                </button>
                <button
                  class="image-modal-nav next"
                  type="button"
                  onClick={goModalNext}
                  aria-label="Next image"
                  disabled={imageModalItems().length <= 1}
                >
                  ▶
                </button>
              </div>
              <div class="image-modal-info">
                <div>
                  <p class="panel-kicker">Generated image</p>
                  <h3 class="image-modal-title">{item().title}</h3>
                  <p class="image-modal-subtitle">{item().subtitle}</p>
                </div>
                <div class="image-modal-index">
                  Image {imageModalIndex() + 1} of {imageModalItems().length}
                </div>
                <div class="image-modal-meta">
                  <For each={item().meta}>
                    {(meta) => (
                      <div class="definition-item">
                        <span class="definition-term">{meta.label}</span>
                        <span class="definition-value">{meta.value}</span>
                      </div>
                    )}
                  </For>
                </div>
                <div class="image-modal-prompt">
                  <p class="detail-label">Prompt</p>
                  <p>{item().prompt ?? "No prompt available."}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Show>
      <Show when={resetConfirmOpen()}>
        <div class="confirm-modal" role="dialog" aria-modal="true" onClick={cancelReset}>
          <div
            class="confirm-card"
            role="document"
            onClick={(event) => event.stopPropagation()}
          >
            <div class="confirm-header">
              <p class="panel-kicker">Reset studio</p>
              <h3>Are you sure you want to reset?</h3>
              <p class="subtle-text">
                Your current work in the studio will be lost.
              </p>
            </div>
            <div class="confirm-actions">
              <button class="button ghost" type="button" onClick={cancelReset}>
                Cancel
              </button>
              <button class="button primary" type="button" onClick={handleReset}>
                Reset studio
              </button>
            </div>
          </div>
        </div>
      </Show>
      <Show when={deleteConfirmOpen()}>
        <div
          class="confirm-modal"
          role="dialog"
          aria-modal="true"
          onClick={cancelDeleteStory}
        >
          <div
            class="confirm-card"
            role="document"
            onClick={(event) => event.stopPropagation()}
          >
            <div class="confirm-header">
              <p class="panel-kicker">Delete story</p>
              <h3>
                Delete "{deleteTarget()?.title ?? "this story"}"?
              </h3>
              <p class="subtle-text">
                This removes the story and its saved images from your library.
              </p>
            </div>
            <Show when={deleteError()}>
              <div class="panel-note panel-note-inline">{deleteError()}</div>
            </Show>
            <div class="confirm-actions">
              <button class="button ghost" type="button" onClick={cancelDeleteStory}>
                Cancel
              </button>
              <button
                class="button primary"
                type="button"
                onClick={handleDeleteStory}
                disabled={deleteBusy()}
              >
                {deleteBusy() ? "Deleting..." : "Delete story"}
              </button>
            </div>
          </div>
        </div>
      </Show>
      <Show when={unsavedConfirmOpen()}>
        <div
          class="confirm-modal"
          role="dialog"
          aria-modal="true"
          onClick={cancelUnsavedConfirm}
        >
          <div
            class="confirm-card"
            role="document"
            onClick={(event) => event.stopPropagation()}
          >
            <div class="confirm-header">
              <p class="panel-kicker">Unsaved changes</p>
              <h3>Save your draft before leaving?</h3>
              <p class="subtle-text">
                You have edits that haven't been saved to the story desk yet.
              </p>
            </div>
            <Show when={saveError()}>
              <div class="panel-note panel-note-inline">{saveError()}</div>
            </Show>
            <div class="confirm-actions">
              <button class="button ghost" type="button" onClick={cancelUnsavedConfirm}>
                Cancel
              </button>
              <button
                class="button ghost danger"
                type="button"
                onClick={discardUnsavedChanges}
                disabled={unsavedBusy()}
              >
                Discard
              </button>
              <button
                class="button primary"
                type="button"
                onClick={saveAndContinue}
                disabled={unsavedBusy()}
              >
                {unsavedBusy() ? "Saving..." : "Save & continue"}
              </button>
            </div>
          </div>
        </div>
      </Show>
      <Show when={draftValidationOpen()}>
        <div
          class="confirm-modal"
          role="dialog"
          aria-modal="true"
          onClick={closeDraftValidation}
        >
          <div
            class="confirm-card"
            role="document"
            onClick={(event) => event.stopPropagation()}
          >
            <div class="confirm-header">
              <p class="panel-kicker">Draft warning</p>
              <h3>Fill in the required fields before running</h3>
              <p class="subtle-text">
                These fields are required to generate a draft.
              </p>
            </div>
            <div class="missing-field-list">
              <For each={draftMissingFields()}>
                {(field) => (
                  <div class="missing-field-item">{field.label}</div>
                )}
              </For>
            </div>
            <div class="confirm-actions">
              <button class="button primary" type="button" onClick={closeDraftValidation}>
                Got it
              </button>
            </div>
          </div>
        </div>
      </Show>
      </main>
    </Show>
  );
};

export default App;
