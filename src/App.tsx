import {
  For,
  Index,
  Show,
  Suspense,
  createEffect,
  createMemo,
  createSignal,
  lazy,
  onCleanup,
  onMount,
} from "solid-js";

import {
  buildPublishValidation,
  buildStepQaWarnings,
  type PublishChecklistItem,
  type StepQaWarning,
} from "./lib/bookProduction";

const logoUrl = new URL("../assets/logo.png", import.meta.url).href;
const runtimeApiBaseUrl = () => {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (typeof configured === "string" && configured.trim().length > 0) {
    return configured.trim();
  }

  if (typeof window !== "undefined" && import.meta.env.DEV) {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:4000";
    }
  }

  if (typeof window !== "undefined" && !import.meta.env.DEV) {
    const { hostname } = window.location;
    if (
      hostname === "maryannpielago.biz" ||
      hostname === "www.maryannpielago.biz" ||
      hostname.endsWith(".workers.dev")
    ) {
      return "https://api.maryannpielago.biz";
    }
  }

  return "";
};

const apiBaseUrl = runtimeApiBaseUrl();
const backCoverSlogan = "Gentle storybooks for growing hearts";
const backCoverAgeBand = "Ages 5-7";
const defaultPrintBleedInches = 0.125;
const authSessionStorageKey = "mary-ann-stories-session";
const legacyUserStorageKey = "mary-ann-stories-user";
const authSessionVersion = 1;
const cookieSessionMarker = "__cookie_session__";

const isBackendImageProxyUrl = (value: string) => {
  try {
    const target = new URL(
      value,
      typeof window !== "undefined" ? window.location.origin : "http://localhost",
    );
    return target.pathname === "/api/images/proxy" && target.searchParams.has("url");
  } catch {
    return false;
  }
};

const normalizeClientImageUrl = (value: string | undefined) => {
  if (!value || value.trim().length === 0) return undefined;
  if (value.startsWith("data:")) return value;
  if (isBackendImageProxyUrl(value)) return value;

  try {
    const target = new URL(value, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    const apiOrigin = apiBaseUrl || (typeof window !== "undefined" ? window.location.origin : "");
    const isRemoteHttp = target.protocol === "http:" || target.protocol === "https:";
    if (!isRemoteHttp || !apiOrigin) {
      return value;
    }

    return `${apiOrigin}/api/images/proxy?url=${encodeURIComponent(target.toString())}`;
  } catch {
    return value;
  }
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Unable to convert image blob to data URL."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read image blob."));
    reader.readAsDataURL(blob);
  });

let qrCodeModulePromise: Promise<typeof import("qrcode")> | null = null;
let jsPdfModulePromise: Promise<typeof import("jspdf")> | null = null;
let jsZipModulePromise: Promise<typeof import("jszip")> | null = null;

const loadQrCode = async () => {
  const module = await (qrCodeModulePromise ??= import("qrcode"));
  return module.default;
};

const loadJsPdf = async () => {
  const module = await (jsPdfModulePromise ??= import("jspdf"));
  return module.jsPDF;
};

const loadJsZip = async () => {
  const module = await (jsZipModulePromise ??= import("jszip"));
  return module.default;
};

const StoryDeskHome = lazy(() => import("./components/StoryDeskHome"));
const ImagesWorkspace = lazy(() => import("./components/ImagesWorkspace"));
const LayoutStudio = lazy(() => import("./components/LayoutStudio"));

type ColorMode = "light" | "dark";
type WorkspaceTab = "request" | "output" | "final" | "images" | "layout";
type WorkspaceView = "home" | "studio";
type HomeShelfTab = "private" | "published";
type AuthMode = "login" | "register";
type SpreadLayout = "full" | "split";
type BookLayoutPreset = "bottom-band" | "top-cloud" | "left-text" | "right-text";
type BookLayoutFont = "storybook-serif" | "friendly-sans" | "classic-print";
type BookLayoutTextSurface = "panel" | "floating";
type BookLayoutFontWeight = "regular" | "medium" | "semibold" | "bold";
type BookLayoutTextWidth = "full" | "third";
type BookLayoutTextPosition =
  | "top"
  | "middle"
  | "bottom"
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";
type RouteState = {
  view: WorkspaceView;
  tab?: WorkspaceTab;
  story?: string | null;
};

type AuthSessionSnapshot = {
  version: number;
  token: string;
  username: string;
  userId: number;
  expiresAt: number;
};

type AuthApiResponse = {
  status: string;
  user?: {
    id?: number;
    username?: string;
  };
  session?: {
    token?: string;
    expires_at?: number;
  };
  error?: string;
};

type AuthSessionStatusResponse = {
  status: string;
  valid?: boolean;
  user?: {
    id?: number;
    username?: string;
  } | null;
  session?: {
    expires_at?: number;
  } | null;
};

type AdditionalCharacter = {
  name: string;
  role: string;
  creatureType: string;
  gender: string;
};

type BuilderState = {
  theme: string;
  explicitContentEnabled: boolean;
  protagonist: string;
  creatureType: string;
  protagonistGender: string;
  protagonistTrait: string;
  additionalCharacters: AdditionalCharacter[];
  setting: string;
  themeLesson: string;
  ageBand: string;
  genre: string;
  mood: string;
  narrativeStyle: string;
  endingType: string;
  artStyle: string;
  visualPreset: string;
  paletteDirection: string;
  lineWorkStyle: string;
  textureStyle: string;
  lightingStyle: string;
  characterDesignStyle: string;
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

type BookLayoutSettings = {
  bookLayoutTextSurface: BookLayoutTextSurface;
  bookLayoutTextWidth: BookLayoutTextWidth;
  bookLayoutTextPosition: BookLayoutTextPosition;
  bookLayoutFont: BookLayoutFont;
  bookLayoutFontWeight: BookLayoutFontWeight;
  bookLayoutFontScale: number;
  bookLayoutHorizontalOffset: number;
};

type ImageVersionEntry = {
  id: string;
  status: "generated" | "saved";
  prompt: string;
  imageUrl?: string;
  storedUrl?: string;
  createdAt: string;
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
  imageProvider: "default" | "openai" | "gemini";
  imageModel: string;
  bookLayoutPreset: BookLayoutPreset;
  bookLayoutTextSurface: BookLayoutTextSurface;
  bookLayoutTextWidth: BookLayoutTextWidth;
  bookLayoutTextPosition: BookLayoutTextPosition;
  bookLayoutFont: BookLayoutFont;
  bookLayoutFontWeight: BookLayoutFontWeight;
  bookLayoutFontScale: number;
  bookLayoutHorizontalOffset: number;
  pageLayoutOverrides: Record<string, BookLayoutSettings>;
  promptOverrides: Record<string, string>;
  backCoverSlogan: string;
  backCoverTagline: string;
  backCoverBlurb: string;
  backCoverAgeBand: string;
  backCoverQrUrl: string;
  backCoverShowLogo: boolean;
  backCoverShowSlogan: boolean;
  backCoverShowTagline: boolean;
  backCoverShowBlurb: boolean;
  backCoverShowAgeBand: boolean;
  backCoverShowQr: boolean;
  backCoverShowBarcode: boolean;
  backCoverBarcodeText: string;
  printBleedInches: number;
  printShowTrimMarks: boolean;
  printShowSafeZone: boolean;
  lockedSteps: Record<string, boolean>;
  imageHistory: Record<string, ImageVersionEntry[]>;
  qaReviewedSteps: Record<string, boolean>;
  qaReviewNotes: Record<string, string>;
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
  styleLock: string;
  continuityToken: string;
  castLine: string;
  palette: string[];
  coverPrompt: string;
  backCoverPrompt: string;
  characterPrompts: ImagePromptEntry[];
  scenePrompts: ImagePromptEntry[];
  assetCards: ImageAssetCard[];
};

type ImageStep = {
  id: string;
  label: string;
  kind: "cover" | "back_cover" | "page";
  prompt: string;
  pageIndex?: number;
};

type StepGeometry = {
  aspectRatioLabel: string;
  outputSizeLabel: string;
  openAiSize: string;
  trimLabel: string;
  width: number;
  height: number;
  pixelWidth: number;
  pixelHeight: number;
  pixelSizeLabel: string;
};

type ReferenceImageSource = {
  src: string;
  kind: "cover" | "page";
};

type ImageStepResult = {
  status: "idle" | "generated" | "saved";
  imageUrl?: string;
  storedUrl?: string;
  generatedAt?: string;
  qaState?: "idle" | "running" | "complete" | "error";
  qaReport?: ImageQaReport;
  qaError?: string;
};

type ImageQaReport = {
  summary: string;
  checkedAt: string;
  issues: StepQaWarning[];
  imageWidth?: number;
  imageHeight?: number;
  expectedAspectRatio?: string;
  expectedPixelWidth?: number;
  expectedPixelHeight?: number;
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

type BookEmulatorSheet = {
  id: string;
  label: string;
  subtitle: string;
  kind: "cover" | "back_cover" | "page";
  imageUrl?: string;
  geometry: StepGeometry;
  status: "idle" | "generated" | "saved";
  text: string;
  layout: BookLayoutSettings;
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
  ownerUsername: string;
  visibility: "private" | "public";
  viewerOwnsEntry: boolean;
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
  kind: "cover" | "back_cover" | "page";
  page_index?: number | null;
  prompt?: string | null;
  created_at: string;
};

type ImageListResponse = {
  status: string;
  images: ImageRecordResponse[];
};

type ImageQaResponse = {
  status?: string;
  summary?: string;
  issues?: Array<{
    id?: string;
    label?: string;
    detail?: string;
    severity?: "warning" | "blocker";
  }>;
  error?: string;
};

const ageBands = [
  "Ages 3-5",
  "Ages 5-7",
  "Ages 7-9",
  "Family read-aloud",
];
const adultAgeBand = "18+";

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
  "Warm watercolor storybook",
  "Cut-paper collage",
  "Soft gouache",
  "Golden storybook ink",
  "Whimsical pastel",
  "Moonlit pencil",
];

const warmWatercolorPreset = {
  id: "warm-watercolor-storybook",
  label: "Warm watercolor storybook",
  description: "Soft watercolor, nostalgic golden light, gentle outlines, and rounded storybook charm.",
  values: {
    artStyle: "Warm watercolor storybook",
    paletteDirection: "Soft pastels with sunlit yellows, grassy greens, and earthy browns",
    lineWorkStyle: "Soft broken brown-ink outlines",
    textureStyle: "Watercolor paper grain with stippling and light cross-hatching",
    lightingStyle: "Golden-hour glow with nostalgic warmth",
    characterDesignStyle: "Soft-rounded friendly children's-book characters",
  },
};

const visualPresets = [
  {
    id: "custom",
    label: "Custom",
    description: "Keep the current art settings and fine-tune them manually.",
  },
  warmWatercolorPreset,
];

const paletteDirections = [
  "Soft pastels with sunlit yellows, grassy greens, and earthy browns",
  "Mint, peach, and sky blue pastels",
  "Blush pink, baby blue, and cream",
  "Honey gold, olive, and cocoa",
  "Lavender, periwinkle, and mint",
];

const lineWorkStyles = [
  "Soft broken brown-ink outlines",
  "Thin hand-drawn pencil outlines",
  "Gentle brush outlines",
  "Painterly edges with minimal outlines",
];

const textureStyles = [
  "Watercolor paper grain with stippling and light cross-hatching",
  "Soft watercolor blooms and paper texture",
  "Gouache grain with subtle dry-brush texture",
  "Ink hatch shading with light wash texture",
];

const lightingStyles = [
  "Golden-hour glow with nostalgic warmth",
  "Soft daylight haze",
  "Cozy indoor lamp glow",
  "Moonlit hush with gentle contrast",
];

const characterDesignStyles = [
  "Soft-rounded friendly children's-book characters",
  "Classic whimsical picture-book children",
  "Gentle anthropomorphic storybook animals",
  "Simple rounded silhouettes with expressive faces",
];

const defaultVisualPreset = warmWatercolorPreset;

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

const supportingRoles = [
  "Friend",
  "Mentor",
  "Guardian",
  "Rival",
  "Sibling",
  "Classmate",
  "Guide",
  "Helper",
  "Villager",
  "Pet",
  "Antagonist",
];

const genderOptions = ["Female", "Male", "None"];

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

const imageProviderOptions: Array<{
  id: ImageSettings["imageProvider"];
  label: string;
  note: string;
}> = [
  {
    id: "default",
    label: "Server default",
    note: "Uses the backend default provider setting.",
  },
  {
    id: "gemini",
    label: "Gemini",
    note: "Use Gemini for image generation for this story.",
  },
  {
    id: "openai",
    label: "OpenAI",
    note: "Use OpenAI for image generation for this story.",
  },
];

const imageModelOptionsByProvider: Record<
  Exclude<ImageSettings["imageProvider"], "default">,
  Array<{ id: string; label: string; note: string }>
> = {
  gemini: [
    {
      id: "server-default",
      label: "Server default",
      note: "Use the backend Gemini image model setting.",
    },
    {
      id: "gemini-3-pro-image-preview",
      label: "Gemini 3 Pro Image Preview",
      note: "Highest-fidelity Gemini image generation for story continuity.",
    },
    {
      id: "gemini-2.5-flash-image",
      label: "Gemini 2.5 Flash Image",
      note: "Faster Gemini image model for lighter image runs.",
    },
  ],
  openai: [
    {
      id: "server-default",
      label: "Server default",
      note: "Use the backend OpenAI image model setting.",
    },
    {
      id: "dall-e-3",
      label: "DALL-E 3",
      note: "OpenAI image generation for polished book-style artwork.",
    },
  ],
};

const bookLayoutPresetOptions: Array<{
  id: BookLayoutPreset;
  label: string;
  note: string;
}> = [
  {
    id: "bottom-band",
    label: "Bottom band",
    note: "Wide illustration with a grounded text band across the lower safe area.",
  },
  {
    id: "top-cloud",
    label: "Top cloud",
    note: "Keep the art open while floating the story text in a soft rounded cloud up top.",
  },
  {
    id: "left-text",
    label: "Left text / right art",
    note: "Split the spread so the story text lives on the left page and the art breathes on the right.",
  },
  {
    id: "right-text",
    label: "Right text / left art",
    note: "Mirror the spread with the art on the left page and the reading panel on the right.",
  },
];

const bookLayoutTextWidthOptions: Array<{
  id: BookLayoutTextWidth;
  label: string;
  note: string;
}> = [
  {
    id: "full",
    label: "Across image",
    note: "Stretch the reading panel across the spread like a full-width story band.",
  },
  {
    id: "third",
    label: "Compressed third",
    note: "Shrink the text box to about a third of the spread so more of the illustration stays visible.",
  },
];

const bookLayoutTextSurfaceOptions: Array<{
  id: BookLayoutTextSurface;
  label: string;
  note: string;
}> = [
  {
    id: "panel",
    label: "Paper panel",
    note: "Keep the story on a soft paper card so it reads like a printed picture-book surface.",
  },
  {
    id: "floating",
    label: "Text only",
    note: "Remove the paper panel and let the copy sit directly on the art with lighter styling.",
  },
];

const fullWidthTextPositionOptions: Array<{
  id: Extract<BookLayoutTextPosition, "top" | "middle" | "bottom">;
  label: string;
}> = [
  { id: "top", label: "Top" },
  { id: "middle", label: "Middle" },
  { id: "bottom", label: "Bottom" },
];

const compactTextPositionOptions: Array<{
  id: Exclude<BookLayoutTextPosition, "top" | "middle" | "bottom">;
  label: string;
}> = [
  { id: "top-left", label: "Top left" },
  { id: "top-center", label: "Top center" },
  { id: "top-right", label: "Top right" },
  { id: "middle-left", label: "Middle left" },
  { id: "middle-center", label: "Middle center" },
  { id: "middle-right", label: "Middle right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom-center", label: "Bottom center" },
  { id: "bottom-right", label: "Bottom right" },
];

const bookLayoutFontOptions: Array<{
  id: BookLayoutFont;
  label: string;
  note: string;
  family: string;
}> = [
  {
    id: "storybook-serif",
    label: "Storybook serif",
    note: "Classic read-aloud page feel with warm printed-book contrast.",
    family: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
  },
  {
    id: "friendly-sans",
    label: "Friendly sans",
    note: "Rounded, clean text for a brighter picture-book reading voice.",
    family: '"Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif',
  },
  {
    id: "classic-print",
    label: "Classic print",
    note: "A slightly more formal picture-book page with crisp print rhythm.",
    family: '"Gill Sans", "Century Gothic", Verdana, sans-serif',
  },
];

const bookLayoutFontWeightOptions: Array<{
  id: BookLayoutFontWeight;
  label: string;
  note: string;
  weight: number;
}> = [
  {
    id: "regular",
    label: "Regular",
    note: "Keep the page copy light and airy for open illustrations.",
    weight: 400,
  },
  {
    id: "medium",
    label: "Medium",
    note: "A little more presence without looking heavy on the page.",
    weight: 500,
  },
  {
    id: "semibold",
    label: "Semibold",
    note: "Useful when the art is busy and the story text needs extra hold.",
    weight: 600,
  },
  {
    id: "bold",
    label: "Bold",
    note: "Strongest reading voice for dense or high-contrast spreads.",
    weight: 700,
  },
];

const getBookSize = (id: string) =>
  bookSizes.find((option) => option.id === id) ?? bookSizes[1] ?? bookSizes[0]!;

const getSpreadLayoutLabel = (layout: SpreadLayout) =>
  spreadLayoutOptions.find((option) => option.id === layout)?.label ??
  "Full spread image";

const getEffectiveImageProvider = (provider: ImageSettings["imageProvider"]) =>
  provider === "default" ? "gemini" : provider;

const getImageModelOptions = (provider: ImageSettings["imageProvider"]) =>
  imageModelOptionsByProvider[getEffectiveImageProvider(provider)];

const getBookLayoutPreset = (preset: BookLayoutPreset) =>
  bookLayoutPresetOptions.find((option) => option.id === preset) ?? bookLayoutPresetOptions[0]!;

const getBookLayoutTextWidth = (width: BookLayoutTextWidth) =>
  bookLayoutTextWidthOptions.find((option) => option.id === width) ??
  bookLayoutTextWidthOptions[0]!;

const getBookLayoutTextSurface = (surface: BookLayoutTextSurface) =>
  bookLayoutTextSurfaceOptions.find((option) => option.id === surface) ??
  bookLayoutTextSurfaceOptions[0]!;

const getLegacyLayoutSettings = (
  preset: BookLayoutPreset,
): { width: BookLayoutTextWidth; position: BookLayoutTextPosition } => {
  switch (preset) {
    case "top-cloud":
      return { width: "full", position: "top" };
    case "left-text":
      return { width: "third", position: "middle-left" };
    case "right-text":
      return { width: "third", position: "middle-right" };
    case "bottom-band":
    default:
      return { width: "full", position: "bottom" };
  }
};

const getBookLayoutTextPositionOptions = (width: BookLayoutTextWidth) =>
  width === "full" ? fullWidthTextPositionOptions : compactTextPositionOptions;

const getDefaultTextPositionForWidth = (width: BookLayoutTextWidth): BookLayoutTextPosition =>
  width === "full" ? "bottom" : "bottom-center";

const getBookLayoutFont = (font: BookLayoutFont) =>
  bookLayoutFontOptions.find((option) => option.id === font) ?? bookLayoutFontOptions[0]!;

const getBookLayoutFontWeight = (weight: BookLayoutFontWeight) =>
  bookLayoutFontWeightOptions.find((option) => option.id === weight) ??
  bookLayoutFontWeightOptions[0]!;

const getBookLayoutDefaultsFromImageSettings = (
  settings: Pick<
    ImageSettings,
    | "bookLayoutTextSurface"
    | "bookLayoutTextWidth"
    | "bookLayoutTextPosition"
    | "bookLayoutFont"
    | "bookLayoutFontWeight"
    | "bookLayoutFontScale"
    | "bookLayoutHorizontalOffset"
  >,
): BookLayoutSettings => ({
  bookLayoutTextSurface: settings.bookLayoutTextSurface,
  bookLayoutTextWidth: settings.bookLayoutTextWidth,
  bookLayoutTextPosition: settings.bookLayoutTextPosition,
  bookLayoutFont: settings.bookLayoutFont,
  bookLayoutFontWeight: settings.bookLayoutFontWeight,
  bookLayoutFontScale: settings.bookLayoutFontScale,
  bookLayoutHorizontalOffset: settings.bookLayoutHorizontalOffset,
});

const normalizeBookLayoutSettings = (
  value: Partial<BookLayoutSettings> | null | undefined,
  fallback: BookLayoutSettings,
): BookLayoutSettings => {
  const source = value ?? {};
  const layoutWidth = bookLayoutTextWidthOptions.some(
    (option) => option.id === source.bookLayoutTextWidth,
  )
    ? source.bookLayoutTextWidth!
    : fallback.bookLayoutTextWidth;
  const layoutSurface = bookLayoutTextSurfaceOptions.some(
    (option) => option.id === source.bookLayoutTextSurface,
  )
    ? source.bookLayoutTextSurface!
    : fallback.bookLayoutTextSurface;
  const availableTextPositions = getBookLayoutTextPositionOptions(layoutWidth);
  const layoutPosition = availableTextPositions.some(
    (option) => option.id === source.bookLayoutTextPosition,
  )
    ? source.bookLayoutTextPosition!
    : layoutWidth === fallback.bookLayoutTextWidth
      ? fallback.bookLayoutTextPosition
      : getDefaultTextPositionForWidth(layoutWidth);
  const layoutFont = bookLayoutFontOptions.some((option) => option.id === source.bookLayoutFont)
    ? source.bookLayoutFont!
    : fallback.bookLayoutFont;
  const layoutFontWeight = bookLayoutFontWeightOptions.some(
    (option) => option.id === source.bookLayoutFontWeight,
  )
    ? source.bookLayoutFontWeight!
    : fallback.bookLayoutFontWeight;
  const layoutFontScale =
    typeof source.bookLayoutFontScale === "number" &&
    Number.isFinite(source.bookLayoutFontScale)
      ? clampNumber(source.bookLayoutFontScale, 0.85, 1.45)
      : fallback.bookLayoutFontScale;
  const layoutHorizontalOffset =
    typeof source.bookLayoutHorizontalOffset === "number" &&
    Number.isFinite(source.bookLayoutHorizontalOffset)
      ? clampNumber(source.bookLayoutHorizontalOffset, -18, 18)
      : fallback.bookLayoutHorizontalOffset;
  return {
    bookLayoutTextSurface: layoutSurface,
    bookLayoutTextWidth: layoutWidth,
    bookLayoutTextPosition: layoutPosition,
    bookLayoutFont: layoutFont,
    bookLayoutFontWeight: layoutFontWeight,
    bookLayoutFontScale: layoutFontScale,
    bookLayoutHorizontalOffset: layoutHorizontalOffset,
  };
};

const getBookLayoutSettingsForPageId = (
  settings: ImageSettings,
  pageId: string,
): BookLayoutSettings =>
  normalizeBookLayoutSettings(
    settings.pageLayoutOverrides[pageId],
    getBookLayoutDefaultsFromImageSettings(settings),
  );

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const cloneBuilder = (state: BuilderState): BuilderState => ({
  ...state,
  additionalCharacters: state.additionalCharacters.map((character) => ({ ...character })),
});

const cloneImageSettings = (settings: ImageSettings): ImageSettings => ({
  ...settings,
  pageLayoutOverrides: Object.fromEntries(
    Object.entries(settings.pageLayoutOverrides ?? {}).map(([key, value]) => [
      key,
      { ...value },
    ]),
  ),
  promptOverrides: { ...(settings.promptOverrides ?? {}) },
  lockedSteps: { ...(settings.lockedSteps ?? {}) },
  imageHistory: Object.fromEntries(
    Object.entries(settings.imageHistory ?? {}).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.map((entry) => ({ ...entry })) : [],
    ]),
  ),
  qaReviewedSteps: { ...(settings.qaReviewedSteps ?? {}) },
  qaReviewNotes: { ...(settings.qaReviewNotes ?? {}) },
});

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
  {
    id: "layout",
    label: "Layout",
    note: "Place the story text over the approved art like a real picture book.",
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
  explicitContentEnabled: false,
  protagonist: "",
  creatureType: "",
  protagonistGender: "",
  protagonistTrait: "",
  additionalCharacters: [],
  setting: "",
  themeLesson: "",
  ageBand: ageBands[0],
  genre: genres[0],
  mood: moods[0],
  narrativeStyle: narrativeStyles[0],
  endingType: endingTypes[0],
  artStyle: defaultVisualPreset.values.artStyle,
  visualPreset: defaultVisualPreset.id,
  paletteDirection: defaultVisualPreset.values.paletteDirection,
  lineWorkStyle: defaultVisualPreset.values.lineWorkStyle,
  textureStyle: defaultVisualPreset.values.textureStyle,
  lightingStyle: defaultVisualPreset.values.lightingStyle,
  characterDesignStyle: defaultVisualPreset.values.characterDesignStyle,
  language: languages[0],
  conflictType: conflictTypes[0],
  illustrationConsistency: "",
  safetyConstraints: "",
  spreads: 10,
};

const resetState: BuilderState = {
  theme: "",
  explicitContentEnabled: false,
  protagonist: "",
  creatureType: "",
  protagonistGender: "",
  protagonistTrait: "",
  additionalCharacters: [],
  setting: "",
  themeLesson: "",
  ageBand: ageBands[0],
  genre: genres[0],
  mood: moods[0],
  narrativeStyle: narrativeStyles[0],
  endingType: endingTypes[0],
  artStyle: defaultVisualPreset.values.artStyle,
  visualPreset: defaultVisualPreset.id,
  paletteDirection: defaultVisualPreset.values.paletteDirection,
  lineWorkStyle: defaultVisualPreset.values.lineWorkStyle,
  textureStyle: defaultVisualPreset.values.textureStyle,
  lightingStyle: defaultVisualPreset.values.lightingStyle,
  characterDesignStyle: defaultVisualPreset.values.characterDesignStyle,
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
  imageProvider: "default",
  imageModel: "server-default",
  bookLayoutPreset: "bottom-band",
  bookLayoutTextSurface: "panel",
  bookLayoutTextWidth: "full",
  bookLayoutTextPosition: "bottom",
  bookLayoutFont: "storybook-serif",
  bookLayoutFontWeight: "regular",
  bookLayoutFontScale: 1,
  bookLayoutHorizontalOffset: 0,
  pageLayoutOverrides: {},
  promptOverrides: {},
  backCoverSlogan,
  backCoverTagline: "",
  backCoverBlurb: "",
  backCoverAgeBand: "",
  backCoverQrUrl: "",
  backCoverShowLogo: true,
  backCoverShowSlogan: true,
  backCoverShowTagline: false,
  backCoverShowBlurb: false,
  backCoverShowAgeBand: true,
  backCoverShowQr: true,
  backCoverShowBarcode: false,
  backCoverBarcodeText: "",
  printBleedInches: defaultPrintBleedInches,
  printShowTrimMarks: true,
  printShowSafeZone: true,
  lockedSteps: {},
  imageHistory: {},
  qaReviewedSteps: {},
  qaReviewNotes: {},
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

const mapSavedImagesToResults = (
  images: ImageRecordResponse[],
  existingResults: Record<string, ImageStepResult> = {},
) => {
  const results: Record<string, ImageStepResult> = {};
  for (const image of images) {
    let stepId: string | null = null;
    if (image.kind === "cover") {
      stepId = "cover";
    } else if (image.kind === "back_cover") {
      stepId = "back-cover";
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
    const existing = existingResults[stepId];
    const normalizedUrl = normalizeClientImageUrl(url ?? undefined);
    results[stepId] = {
      ...existing,
      status: "saved",
      imageUrl: normalizedUrl,
      storedUrl: normalizedUrl,
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

const normalizeAdditionalCharacters = (value: unknown): AdditionalCharacter[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") {
      return { name: item, role: "", creatureType: "", gender: "" };
    }
    if (item && typeof item === "object") {
      const data = item as {
        name?: unknown;
        role?: unknown;
        creatureType?: unknown;
        gender?: unknown;
      };
      return {
        name: typeof data.name === "string" ? data.name : "",
        role: typeof data.role === "string" ? data.role : "",
        creatureType: typeof data.creatureType === "string" ? data.creatureType : "",
        gender: typeof data.gender === "string" ? data.gender : "",
      };
    }
    return { name: "", role: "", creatureType: "", gender: "" };
  });
};

const applyVisualDirectionDefaults = (
  parsed: Partial<BuilderState>,
  state: BuilderState,
): BuilderState => {
  const hasStructuredVisualDirection = [
    parsed.visualPreset,
    parsed.paletteDirection,
    parsed.lineWorkStyle,
    parsed.textureStyle,
    parsed.lightingStyle,
    parsed.characterDesignStyle,
  ].some((value) => typeof value === "string" && value.trim().length > 0);
  const parsedArtStyle =
    typeof parsed.artStyle === "string" ? parsed.artStyle.trim() : "";
  const shouldUpgradeLegacyDefaults =
    !hasStructuredVisualDirection &&
    (parsedArtStyle.length === 0 || parsedArtStyle === "Painted watercolor");

  if (shouldUpgradeLegacyDefaults) {
    return {
      ...state,
      visualPreset: defaultVisualPreset.id,
      ...defaultVisualPreset.values,
    };
  }

  if (state.visualPreset === defaultVisualPreset.id) {
    return {
      ...state,
      artStyle:
        state.artStyle.trim().length > 0 && state.artStyle !== "Painted watercolor"
          ? state.artStyle
          : defaultVisualPreset.values.artStyle,
      paletteDirection:
        state.paletteDirection.trim().length > 0
          ? state.paletteDirection
          : defaultVisualPreset.values.paletteDirection,
      lineWorkStyle:
        state.lineWorkStyle.trim().length > 0
          ? state.lineWorkStyle
          : defaultVisualPreset.values.lineWorkStyle,
      textureStyle:
        state.textureStyle.trim().length > 0
          ? state.textureStyle
          : defaultVisualPreset.values.textureStyle,
      lightingStyle:
        state.lightingStyle.trim().length > 0
          ? state.lightingStyle
          : defaultVisualPreset.values.lightingStyle,
      characterDesignStyle:
        state.characterDesignStyle.trim().length > 0
          ? state.characterDesignStyle
          : defaultVisualPreset.values.characterDesignStyle,
    };
  }

  return state;
};

const normalizeBuilderSnapshot = (value: string | null | undefined): BuilderState => {
  const parsed = safeParseJson<Partial<BuilderState>>(value, {});
  const additionalCharacters = normalizeAdditionalCharacters(parsed.additionalCharacters);
  const merged = {
    ...initialState,
    ...parsed,
    explicitContentEnabled:
      typeof parsed.explicitContentEnabled === "boolean"
        ? parsed.explicitContentEnabled
        : parsed.ageBand === adultAgeBand,
    additionalCharacters,
  };
  return applyVisualDirectionDefaults(parsed, merged);
};

const normalizeImageSettingsSnapshot = (
  value: string | null | undefined,
): ImageSettings => {
  const parsed = safeParseJson<Partial<ImageSettings>>(value, {});
  const promptOverrides =
    parsed.promptOverrides &&
    typeof parsed.promptOverrides === "object" &&
    !Array.isArray(parsed.promptOverrides)
      ? Object.fromEntries(
          Object.entries(parsed.promptOverrides).flatMap(([key, entry]) =>
            typeof entry === "string" ? [[key, entry]] : [],
          ),
        )
      : {};
  const normalized = {
    ...initialImageSettings,
    ...parsed,
    promptOverrides,
  };
  const availableModels = getImageModelOptions(normalized.imageProvider);
  const hasSelectedModel = availableModels.some((option) => option.id === normalized.imageModel);
  const layoutPreset = bookLayoutPresetOptions.some(
    (option) => option.id === normalized.bookLayoutPreset,
  )
    ? normalized.bookLayoutPreset
    : initialImageSettings.bookLayoutPreset;
  const legacyLayout = getLegacyLayoutSettings(layoutPreset);
  const layoutWidth = bookLayoutTextWidthOptions.some(
    (option) => option.id === normalized.bookLayoutTextWidth,
  )
    ? normalized.bookLayoutTextWidth
    : legacyLayout.width;
  const layoutSurface = bookLayoutTextSurfaceOptions.some(
    (option) => option.id === normalized.bookLayoutTextSurface,
  )
    ? normalized.bookLayoutTextSurface
    : initialImageSettings.bookLayoutTextSurface;
  const availableTextPositions = getBookLayoutTextPositionOptions(layoutWidth);
  const layoutPosition = availableTextPositions.some(
    (option) => option.id === normalized.bookLayoutTextPosition,
  )
    ? normalized.bookLayoutTextPosition
    : layoutWidth === legacyLayout.width
      ? legacyLayout.position
      : getDefaultTextPositionForWidth(layoutWidth);
  const layoutFont = bookLayoutFontOptions.some((option) => option.id === normalized.bookLayoutFont)
    ? normalized.bookLayoutFont
    : initialImageSettings.bookLayoutFont;
  const layoutFontWeight = bookLayoutFontWeightOptions.some(
    (option) => option.id === normalized.bookLayoutFontWeight,
  )
    ? normalized.bookLayoutFontWeight
    : initialImageSettings.bookLayoutFontWeight;
  const layoutFontScale =
    typeof normalized.bookLayoutFontScale === "number" &&
    Number.isFinite(normalized.bookLayoutFontScale)
      ? clampNumber(normalized.bookLayoutFontScale, 0.85, 1.45)
      : initialImageSettings.bookLayoutFontScale;
  const layoutHorizontalOffset =
    typeof normalized.bookLayoutHorizontalOffset === "number" &&
    Number.isFinite(normalized.bookLayoutHorizontalOffset)
      ? clampNumber(normalized.bookLayoutHorizontalOffset, -18, 18)
      : initialImageSettings.bookLayoutHorizontalOffset;
  const layoutDefaults: BookLayoutSettings = {
    bookLayoutTextSurface: layoutSurface,
    bookLayoutTextWidth: layoutWidth,
    bookLayoutTextPosition: layoutPosition,
    bookLayoutFont: layoutFont,
    bookLayoutFontWeight: layoutFontWeight,
    bookLayoutFontScale: layoutFontScale,
    bookLayoutHorizontalOffset: layoutHorizontalOffset,
  };
  const pageLayoutOverrides =
    normalized.pageLayoutOverrides &&
    typeof normalized.pageLayoutOverrides === "object" &&
    !Array.isArray(normalized.pageLayoutOverrides)
      ? Object.fromEntries(
          Object.entries(normalized.pageLayoutOverrides).flatMap(([key, entry]) => {
            if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
              return [];
            }
            return [[key, normalizeBookLayoutSettings(entry as Partial<BookLayoutSettings>, layoutDefaults)]];
          }),
        )
      : {};
  const lockedSteps =
    normalized.lockedSteps &&
    typeof normalized.lockedSteps === "object" &&
    !Array.isArray(normalized.lockedSteps)
      ? Object.fromEntries(
          Object.entries(normalized.lockedSteps).flatMap(([key, entry]) =>
            typeof entry === "boolean" ? [[key, entry]] : [],
          ),
        )
      : {};
  const imageHistory =
    normalized.imageHistory &&
    typeof normalized.imageHistory === "object" &&
    !Array.isArray(normalized.imageHistory)
      ? Object.fromEntries(
          Object.entries(normalized.imageHistory).map(([key, entries]) => [
            key,
            Array.isArray(entries)
              ? entries
                  .filter((entry) => entry && typeof entry === "object")
                  .map((entry) => {
                    const data = entry as Partial<ImageVersionEntry>;
                    return {
                      id:
                        typeof data.id === "string" && data.id.trim().length > 0
                          ? data.id
                          : `${key}-${Math.random().toString(36).slice(2, 10)}`,
                      status: data.status === "saved" ? "saved" : "generated",
                      prompt: typeof data.prompt === "string" ? data.prompt : "",
                      imageUrl: normalizeClientImageUrl(
                        typeof data.imageUrl === "string" ? data.imageUrl : undefined,
                      ),
                      storedUrl: normalizeClientImageUrl(
                        typeof data.storedUrl === "string" ? data.storedUrl : undefined,
                      ),
                      createdAt:
                        typeof data.createdAt === "string"
                          ? data.createdAt
                          : new Date().toISOString(),
                    } satisfies ImageVersionEntry;
                  })
              : [],
          ]),
        )
      : {};
  const qaReviewedSteps =
    normalized.qaReviewedSteps &&
    typeof normalized.qaReviewedSteps === "object" &&
    !Array.isArray(normalized.qaReviewedSteps)
      ? Object.fromEntries(
          Object.entries(normalized.qaReviewedSteps).flatMap(([key, entry]) =>
            typeof entry === "boolean" ? [[key, entry]] : [],
          ),
        )
      : {};
  const qaReviewNotes =
    normalized.qaReviewNotes &&
    typeof normalized.qaReviewNotes === "object" &&
    !Array.isArray(normalized.qaReviewNotes)
      ? Object.fromEntries(
          Object.entries(normalized.qaReviewNotes).flatMap(([key, entry]) =>
            typeof entry === "string" ? [[key, entry]] : [],
          ),
        )
      : {};
  return {
    ...normalized,
    imageModel: hasSelectedModel ? normalized.imageModel : "server-default",
    bookLayoutPreset: layoutPreset,
    bookLayoutTextSurface: layoutSurface,
    bookLayoutTextWidth: layoutWidth,
    bookLayoutTextPosition: layoutPosition,
    bookLayoutFont: layoutFont,
    bookLayoutFontWeight: layoutFontWeight,
    bookLayoutFontScale: layoutFontScale,
    bookLayoutHorizontalOffset: layoutHorizontalOffset,
    pageLayoutOverrides,
    promptOverrides,
    backCoverSlogan:
      typeof normalized.backCoverSlogan === "string"
        ? normalized.backCoverSlogan
        : initialImageSettings.backCoverSlogan,
    backCoverTagline:
      typeof normalized.backCoverTagline === "string"
        ? normalized.backCoverTagline
        : initialImageSettings.backCoverTagline,
    backCoverBlurb:
      typeof normalized.backCoverBlurb === "string"
        ? normalized.backCoverBlurb
        : initialImageSettings.backCoverBlurb,
    backCoverAgeBand:
      typeof normalized.backCoverAgeBand === "string"
        ? normalized.backCoverAgeBand
        : initialImageSettings.backCoverAgeBand,
    backCoverQrUrl:
      typeof normalized.backCoverQrUrl === "string"
        ? normalized.backCoverQrUrl
        : initialImageSettings.backCoverQrUrl,
    backCoverShowLogo:
      typeof normalized.backCoverShowLogo === "boolean"
        ? normalized.backCoverShowLogo
        : initialImageSettings.backCoverShowLogo,
    backCoverShowSlogan:
      typeof normalized.backCoverShowSlogan === "boolean"
        ? normalized.backCoverShowSlogan
        : initialImageSettings.backCoverShowSlogan,
    backCoverShowTagline:
      typeof normalized.backCoverShowTagline === "boolean"
        ? normalized.backCoverShowTagline
        : initialImageSettings.backCoverShowTagline,
    backCoverShowBlurb:
      typeof normalized.backCoverShowBlurb === "boolean"
        ? normalized.backCoverShowBlurb
        : initialImageSettings.backCoverShowBlurb,
    backCoverShowAgeBand:
      typeof normalized.backCoverShowAgeBand === "boolean"
        ? normalized.backCoverShowAgeBand
        : initialImageSettings.backCoverShowAgeBand,
    backCoverShowQr:
      typeof normalized.backCoverShowQr === "boolean"
        ? normalized.backCoverShowQr
        : initialImageSettings.backCoverShowQr,
    backCoverShowBarcode:
      typeof normalized.backCoverShowBarcode === "boolean"
        ? normalized.backCoverShowBarcode
        : initialImageSettings.backCoverShowBarcode,
    backCoverBarcodeText:
      typeof normalized.backCoverBarcodeText === "string"
        ? normalized.backCoverBarcodeText
        : initialImageSettings.backCoverBarcodeText,
    printBleedInches:
      typeof normalized.printBleedInches === "number" &&
      Number.isFinite(normalized.printBleedInches)
        ? clampNumber(normalized.printBleedInches, 0, 0.25)
        : initialImageSettings.printBleedInches,
    printShowTrimMarks:
      typeof normalized.printShowTrimMarks === "boolean"
        ? normalized.printShowTrimMarks
        : initialImageSettings.printShowTrimMarks,
    printShowSafeZone:
      typeof normalized.printShowSafeZone === "boolean"
        ? normalized.printShowSafeZone
        : initialImageSettings.printShowSafeZone,
    lockedSteps,
    imageHistory,
    qaReviewedSteps,
    qaReviewNotes,
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
      imageUrl: normalizeClientImageUrl(
        typeof entry.imageUrl === "string" ? entry.imageUrl : undefined,
      ),
      storedUrl: normalizeClientImageUrl(
        typeof entry.storedUrl === "string" ? entry.storedUrl : undefined,
      ),
      generatedAt: typeof entry.generatedAt === "string" ? entry.generatedAt : undefined,
      qaState:
        entry.qaState === "running" ||
        entry.qaState === "complete" ||
        entry.qaState === "error"
          ? entry.qaState
          : status === "idle"
            ? "idle"
            : undefined,
      qaError: typeof entry.qaError === "string" ? entry.qaError : undefined,
      qaReport:
        entry.qaReport &&
        typeof entry.qaReport === "object" &&
        !Array.isArray(entry.qaReport)
          ? {
              summary:
                typeof entry.qaReport.summary === "string" ? entry.qaReport.summary : "",
              checkedAt:
                typeof entry.qaReport.checkedAt === "string"
                  ? entry.qaReport.checkedAt
                  : "",
              issues: Array.isArray(entry.qaReport.issues)
                ? entry.qaReport.issues
                    .filter(
                      (issue): issue is StepQaWarning =>
                        Boolean(issue) &&
                        typeof issue === "object" &&
                        typeof issue.id === "string" &&
                        typeof issue.label === "string" &&
                        typeof issue.detail === "string" &&
                        (issue.severity === "warning" || issue.severity === "blocker"),
                    )
                : [],
              imageWidth:
                typeof entry.qaReport.imageWidth === "number" &&
                Number.isFinite(entry.qaReport.imageWidth)
                  ? entry.qaReport.imageWidth
                  : undefined,
              imageHeight:
                typeof entry.qaReport.imageHeight === "number" &&
                Number.isFinite(entry.qaReport.imageHeight)
                  ? entry.qaReport.imageHeight
                  : undefined,
              expectedAspectRatio:
                typeof entry.qaReport.expectedAspectRatio === "string"
                  ? entry.qaReport.expectedAspectRatio
                  : undefined,
              expectedPixelWidth:
                typeof entry.qaReport.expectedPixelWidth === "number" &&
                Number.isFinite(entry.qaReport.expectedPixelWidth)
                  ? entry.qaReport.expectedPixelWidth
                  : undefined,
              expectedPixelHeight:
                typeof entry.qaReport.expectedPixelHeight === "number" &&
                Number.isFinite(entry.qaReport.expectedPixelHeight)
                  ? entry.qaReport.expectedPixelHeight
                  : undefined,
            }
          : undefined,
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
  const providerLabel =
    imageSettingsSnapshot.imageProvider === "default"
      ? "Server default"
      : imageSettingsSnapshot.imageProvider === "gemini"
        ? "Gemini"
        : "OpenAI";
  return [
    { label: "Language", value: builderSnapshot.language },
    { label: "Art style", value: builderSnapshot.artStyle },
    { label: "Spreads", value: String(builderSnapshot.spreads) },
    { label: "Book size", value: bookSize.shortLabel },
    { label: "Image size", value: imageSettingsSnapshot.imageSize },
    { label: "Image provider", value: providerLabel },
    { label: "Ready", value: ready ? "Yes" : "Not yet" },
    { label: "Published", value: published ? "Yes" : "No" },
  ];
};

const buildStoryDeskEntryFromRecord = (
  record: StoryRecordResponse,
  options?: { visibility?: "private" | "public"; viewerUsername?: string | null },
): StoryDeskEntry => {
  const builderSnapshot = normalizeBuilderSnapshot(record.builder_json);
  const imageSettingsSnapshot = normalizeImageSettingsSnapshot(record.image_settings_json);
  const planSnapshot = normalizeStoryPlanSnapshot(record.story_plan_json, builderSnapshot);
  const finalStorySnapshot = normalizeFinalStorySnapshot(record.final_story_json);
  const imageResultsSnapshot = normalizeImageResultsSnapshot(record.image_results_json);
  const statusInfo = resolveStoryStatus(record.status ?? "draft", record.ready, record.published);
  const updatedAt = formatTimestamp(record.updated_at);
  const visibility = options?.visibility ?? "private";
  const viewerUsername = normalizeWhitespace(options?.viewerUsername ?? "");

  return {
    id: record.id,
    ownerUsername: record.username,
    visibility,
    viewerOwnsEntry: viewerUsername.length > 0 && viewerUsername === record.username,
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
  value === "request" ||
  value === "output" ||
  value === "final" ||
  value === "images" ||
  value === "layout"
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

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const normalizeGenderLabel = (value: string) => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return "";
  if (normalized.toLowerCase() === "none") return "";
  return normalized.toLowerCase();
};

const normalizeRoleLabel = (value: string) => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return "";
  return normalized.toLowerCase();
};

const getVisualPreset = (presetId: string) =>
  visualPresets.find((preset) => preset.id === presetId) ?? visualPresets[0];

const coverFooterText = "By: Mary Ann's Stories";

const buildCoverTypographyLayoutLine = (title: string) =>
  [
    `Allowed cover text only: title "${title}" and footer "${coverFooterText}".`,
    "Typography layout: horizontally center the title near the top and horizontally center the footer credit near the bottom.",
    "Keep both text lines on straight horizontal baselines, fully inside generous safe margins, with clear padding from the left, right, top, and bottom edges.",
    "Place the footer credit noticeably above the bottom trim in the lower safe area, not hugging the edge, with generous empty space beneath it.",
    "Keep the title and footer inside an invisible layout frame so neither text block sits too close to any border.",
    "Reserve clean negative space for the title and footer so they never touch, crowd, or clip against the frame.",
  ].join(" ");

const buildArtDirectionParts = (state: BuilderState) =>
  [
    normalizeWhitespace(state.paletteDirection)
      ? `palette direction: ${normalizeWhitespace(state.paletteDirection)}`
      : "",
    normalizeWhitespace(state.lineWorkStyle)
      ? `line work: ${normalizeWhitespace(state.lineWorkStyle)}`
      : "",
    normalizeWhitespace(state.textureStyle)
      ? `texture: ${normalizeWhitespace(state.textureStyle)}`
      : "",
    normalizeWhitespace(state.lightingStyle)
      ? `lighting: ${normalizeWhitespace(state.lightingStyle)}`
      : "",
    normalizeWhitespace(state.characterDesignStyle)
      ? `character design: ${normalizeWhitespace(state.characterDesignStyle)}`
      : "",
  ].filter((part) => part.length > 0);

const takeFirstSentences = (value: string, count = 1) => {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return "";
  const matches = trimmed.match(/[^.!?]+[.!?]?/g);
  if (!matches) return trimmed;
  return matches.slice(0, count).join(" ").trim();
};

const countSentenceLikeSegments = (value: string) => {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return 0;
  const matches = trimmed.match(/[^.!?]+[.!?]?/g);
  return matches?.length ?? 0;
};

const sanitizePageScene = (value: string) => {
  if (!value) return "";
  let scene = normalizeWhitespace(value);
  scene = scene.replace(/\blike\s+[^,.;:!?]+/gi, "");
  scene = scene.replace(/\bas if\s+[^,.;:!?]+/gi, "");
  scene = scene.replace(/\bas though\s+[^,.;:!?]+/gi, "");
  scene = scene.replace(/\bas\s+if\s+[^,.;:!?]+/gi, "");
  scene = scene.replace(/\bseems?\s+to\s+[^,.;:!?]+/gi, "");
  scene = scene.replace(/\bappears?\s+to\s+[^,.;:!?]+/gi, "");
  scene = scene.replace(/\s+([,.;:!?])/g, "$1");
  scene = scene.replace(/\s{2,}/g, " ");
  return scene.trim();
};

const stripQuotedDialogueFromScene = (value: string) => {
  if (!value) return "";
  let scene = normalizeWhitespace(value);
  scene = scene.replace(/\bas if saying,?\s*[“"][^”"]+[”"]/gi, "");
  scene = scene.replace(/\bas if saying[^,.!?;:]*[,.!?;:]?/gi, "");
  scene = scene.replace(/[“"][^”"]+[”"]/g, "");
  scene = scene.replace(/\s+([,.;:!?])/g, "$1");
  scene = scene.replace(/\s{2,}/g, " ");
  return scene.trim();
};

const removeCharacterNamesFromScene = (value: string, state: BuilderState) => {
  let scene = value;
  const protagonist = normalizeWhitespace(state.protagonist);
  if (protagonist.length > 0) {
    const escaped = protagonist.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    scene = scene.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "the protagonist");
  }

  (state.additionalCharacters ?? []).forEach((character) => {
    const name = normalizeWhitespace(character.name);
    if (!name) return;
    const role = normalizeRoleLabel(character.role) || "supporting child";
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    scene = scene.replace(new RegExp(`\\b${escaped}\\b`, "gi"), `the ${role}`);
  });

  return normalizeWhitespace(scene);
};

const literalizePageScene = (value: string) => {
  if (!value) return "";
  let scene = stripQuotedDialogueFromScene(normalizeWhitespace(value));
  scene = scene.replace(
    /\bSunlight spills on ([^,.!?]+?) like warm honey\b/gi,
    "Warm golden sunlight fills $1",
  );
  scene = scene.replace(/\bSunlight spills on\b/gi, "Warm golden sunlight fills");
  scene = scene.replace(/\blike warm honey\b/gi, "");
  scene = scene.replace(
    /\b([A-Z][a-z]+) steps once… twice… and then—oops\b/g,
    "$1 takes a few careful steps and then stumbles",
  );
  scene = scene.replace(
    /\b([A-Z][a-z]+) steps once\.\.\. twice\.\.\. and then—oops\b/g,
    "$1 takes a few careful steps and then stumbles",
  );
  scene = scene.replace(
    /\b([A-Z][a-z]+) steps once\.\.\. twice\.\.\. and then-oops\b/g,
    "$1 takes a few careful steps and then stumbles",
  );
  scene = scene.replace(
    /\b([A-Z][a-z]+) steps once… twice… and then[-—]oops\b/gi,
    "$1 takes a few careful steps and then stumbles",
  );
  scene = scene.replace(/\bHer feet tangle like jump ropes\b/gi, "Her feet tangle into an awkward crisscross");
  scene = scene.replace(/\bHis feet tangle like jump ropes\b/gi, "His feet tangle into an awkward crisscross");
  scene = scene.replace(/\bTheir feet tangle like jump ropes\b/gi, "Their feet tangle into an awkward crisscross");
  scene = scene.replace(/\bfeet tangle like jump ropes\b/gi, "feet tangle into an awkward crisscross");
  scene = scene.replace(
    /\bIn the mirror, it looks even twistier\b/gi,
    "A large wall mirror shows the movement looking even more tangled",
  );
  scene = scene.replace(
    /\bThey finish with steady smiles and bow to their own reflections\b/gi,
    "Both children finish the routine side by side with steady smiles and small respectful bows toward the wall mirror",
  );
  scene = scene.replace(
    /\bThey don['’]t rush\. They don['’]t stop\./gi,
    "Their movement stays calm, steady, and controlled",
  );
  scene = scene.replace(
    /\bsteady steps,\s*listening ears,\s*focused eyes\b/gi,
    "steady dancing, attentive listening, and focused expressions",
  );
  scene = scene.replace(
    /\bStep,\s*hold,\s*turn,\s*breathe\b/gi,
    "They repeat the sequence slowly with a clear step, hold, turn, and breath",
  );
  scene = scene.replace(/…/g, ", ");
  scene = scene.replace(/—/g, ", ");
  scene = scene.replace(/\s+([,.;:!?])/g, "$1");
  scene = scene.replace(/\s{2,}/g, " ");
  return sanitizePageScene(scene);
};

const buildLiteralPageBrief = (
  pageText: string,
  state: BuilderState,
  previousPageText = "",
) => {
  const currentExcerpt = takeFirstSentences(pageText, 5);
  const previousExcerpt = previousPageText ? takeFirstSentences(previousPageText, 2) : "";
  const currentLiteral = removeCharacterNamesFromScene(literalizePageScene(currentExcerpt), state);
  const previousLiteral = removeCharacterNamesFromScene(literalizePageScene(previousExcerpt), state);
  const current = normalizeWhitespace(pageText).toLowerCase();
  const previous = normalizeWhitespace(previousPageText).toLowerCase();
  const currentHasEnoughDetail =
    countSentenceLikeSegments(currentExcerpt) >= 3 || currentLiteral.length >= 180;
  const continuesStudioMoment =
    /\b(?:studio|dance|practice|mirror|barre)\b/.test(`${previous} ${current}`) &&
    !/\b(?:street|outside|bus|shop|market|road|crosswalk|park)\b/.test(current);

  if (currentHasEnoughDetail && currentLiteral.length > 0) {
    return currentLiteral;
  }

  if (continuesStudioMoment && previousLiteral.length > 0 && currentLiteral.length > 0) {
    return `${previousLiteral} Then show this page's specific action: ${currentLiteral}.`;
  }

  return currentLiteral;
};

const buildPageStagingCue = (currentText: string, previousText = "") => {
  const current = normalizeWhitespace(currentText).toLowerCase();
  const previous = normalizeWhitespace(previousText).toLowerCase();
  const cues: string[] = [];

  if (/\b(?:oops|stumble|stumbles|tangle|tangled|stuck|freeze|freezes|forgot where to go)\b/.test(current)) {
    cues.push(
      "Make this page a mistake moment: focus on the protagonist stumbling, freezing, or looking embarrassed after a misstep.",
    );
    cues.push(
      "Show the awkward footwork clearly and make the emotional focus uncertainty or frustration, not confidence or instruction.",
    );
  }

  if (
    /\b(?:scoots close|tiny|spark-steps|one beat at a time|taps the floor|watches|small and doable)\b/.test(
      current,
    )
  ) {
    cues.push(
      "Make this page a coaching moment: focus on the friend guiding the protagonist with one tiny step, a floor tap, or a gentle demonstration.",
    );
    cues.push(
      "Use a more intimate, supportive composition than the previous page and center encouragement, concentration, and learning rather than the stumble itself.",
    );
  }

  if (/\b(?:music keeps going|beat|tap|taps|rhythm)\b/.test(current)) {
    cues.push(
      "Show rhythm through body timing, foot placement, and motion cues in the room, not through written sound-effect text.",
    );
  }

  if (
    /\b(?:studio|dance|practice|mirror|barre)\b/.test(`${previous} ${current}`) &&
    previous.length > 0
  ) {
    cues.push(
      "Keep the same room and characters, but do not repeat the previous page's exact pose, camera angle, or staging.",
    );
  }

  return cues.join(" ");
};

const inferPageVisualAnchors = (currentText: string, previousText = "") => {
  const current = normalizeWhitespace(currentText).toLowerCase();
  const previous = normalizeWhitespace(previousText).toLowerCase();
  const cues: string[] = [];

  if (/\b(?:shop|shops|tree|trees|bus|buses|street|sidewalk|road|crosswalk|city)\b/.test(current)) {
    cues.push("Show the surrounding street clearly with neighborhood shops, trees, sidewalks, and buses.");
  }

  if (
    /\b(?:studio|dance|practice room|classroom|mirror|barre)\b/.test(current) ||
    (!/\b(?:street|outside|bus|shop|market|road|crosswalk|park)\b/.test(current) &&
      /\b(?:studio|dance|practice room|classroom|mirror|barre)\b/.test(previous))
  ) {
    cues.push("Keep the scene inside the same studio or practice room if the page continues that interior moment.");
  }

  if (/\bmirror|reflection|reflections\b/.test(current)) {
    cues.push("Include the wall mirror only if this page explicitly shows the mirror or reflection.");
  }

  if (/\b(?:sunlight|morning|dawn|golden)\b/.test(current)) {
    cues.push("Use warm morning sunlight and clear daytime atmosphere.");
  }

  if (/\b(?:stumble|tangle|trip|oops)\b/.test(current)) {
    cues.push("Show the body movement clearly with tangled feet, slight imbalance, and a child-safe embarrassed expression.");
  }

  return cues.join(" ");
};

const buildSceneLogicCue = (currentText: string, previousText = "") => {
  const current = normalizeWhitespace(currentText).toLowerCase();
  const previous = normalizeWhitespace(previousText).toLowerCase();
  const cues: string[] = [];

  if (/\b(?:shop|shops|tree|trees|bus|buses|street|sidewalk|road|crosswalk|city|traffic)\b/.test(current)) {
    cues.push(
      "Keep street logic physically believable: vehicles stay on the roadway, sidewalks stay clear for pedestrians, and any scooters or bikes must be correctly scaled for the scene.",
    );
    cues.push(
      "Model safe child behavior in public spaces: place children fully on a sidewalk, riverside path, plaza, or other pedestrian-safe area, never in an active roadway or traffic lane.",
    );
    cues.push(
      "If a bus, car, scooter, or bicycle appears, keep it separated from the children by a curb, planted strip, railing, or clear pedestrian boundary.",
    );
    cues.push(
      "Do not show children dancing, playing, stopping, or performing in the road.",
    );
  }

  if (
    /\b(?:studio|dance|practice room|classroom|mirror|barre)\b/.test(current) ||
    (!/\b(?:street|outside|bus|shop|market|road|crosswalk|park)\b/.test(current) &&
      /\b(?:studio|dance|practice room|classroom|mirror|barre)\b/.test(previous))
  ) {
    cues.push(
      "Keep the indoor practice space believable with stable floor perspective, mirror placement, and body scale that matches the reference image.",
    );
    cues.push(
      "Use one coherent room layout with believable spacing between children, floorboards, windows, mirror frame, and furniture.",
    );
  }

  cues.push(
    "Maintain the exact same child age, relative height, head-to-body proportions, face shapes, and outfit scale as the reference image.",
  );
  cues.push(
    "Use physically plausible anatomy, perspective, shadows, reflections, and object scale. Do not invent impossible staging just to fit the composition.",
  );

  return cues.join(" ");
};

const buildCharacterSeparationCue = (state: BuilderState) => {
  const cast = [
    {
      creatureType: normalizeWhitespace(state.creatureType).toLowerCase(),
      gender: normalizeGenderLabel(state.protagonistGender),
    },
    ...(state.additionalCharacters ?? []).map((character) => ({
      creatureType: normalizeWhitespace(character.creatureType).toLowerCase(),
      gender: normalizeGenderLabel(character.gender),
    })),
  ];

  if (cast.length < 2) return "";

  let sharesCreatureType = false;
  let sharesGender = false;

  for (let index = 0; index < cast.length; index += 1) {
    for (let compare = index + 1; compare < cast.length; compare += 1) {
      const left = cast[index]!;
      const right = cast[compare]!;
      if (left.creatureType && right.creatureType && left.creatureType === right.creatureType) {
        sharesCreatureType = true;
      }
      if (left.gender && right.gender && left.gender === right.gender) {
        sharesGender = true;
      }
    }
  }

  const emphasis =
    sharesCreatureType || sharesGender
      ? "This is especially important because some recurring children share the same creature type or gender."
      : "";

  return [
    emphasis,
    "Each recurring child must remain instantly distinguishable at a glance.",
    "Preserve a unique visual identity for each child using a stable combination of hairstyle, face shape, eye shape, outfit colors, shirt pattern, shoes, backpack, accessories, and silhouette.",
    "Do not turn same-gender or same-species children into near-twins, clones, or swapped versions of each other.",
    "Match the unique visual identity of each child from the reference images every time that child appears.",
  ]
    .filter((part) => part.length > 0)
    .join(" ");
};

const buildCharacterIntegrityCue = (state: BuilderState, currentText: string, previousText = "") => {
  const { castList } = buildCastFromState(state);
  if (castList.length === 0) return "";

  const current = normalizeWhitespace(currentText).toLowerCase();
  const previous = normalizeWhitespace(previousText).toLowerCase();
  const cues: string[] = [];
  const characterSeparationCue = buildCharacterSeparationCue(state);

  if (castList.length >= 2) {
    cues.push(
      `Show exactly ${castList.length} distinct recurring children from the reference images: ${formatCastList(castList)}.`,
    );
    cues.push(
      "Do not merge characters together, do not replace one child with a clone of another, and do not drop a recurring child from a shared scene.",
    );
    cues.push(
      "Keep each child visually distinct with consistent hairstyle, face shape, shirt pattern, outfit colors, and relative height from page to page.",
    );

    if (
      /\b(?:studio|dance|practice|mirror|friend|together)\b/.test(current) ||
      (!/\b(?:street|outside|bus|shop|market|road|crosswalk|park)\b/.test(current) &&
        /\b(?:studio|dance|practice|mirror|friend|together)\b/.test(previous))
    ) {
      cues.push("This is a shared scene, so both recurring children should remain visible in the main frame.");
    }
  } else {
    cues.push(`Keep the recurring child from the reference images clearly identifiable as ${castList[0]}.`);
  }

  cues.push(
    "Keep the main child or children facing the reader in a frontal or reader-facing three-quarter view, not a back-only pose.",
  );
  cues.push(
    "Do not let one child fully replace another child in the composition, and do not change one child into a copy of the other.",
  );
  if (characterSeparationCue) {
    cues.push(characterSeparationCue);
  }

  return cues.join(" ");
};

const buildMirrorIntegrityCue = (currentText: string, previousText = "") => {
  const current = normalizeWhitespace(currentText).toLowerCase();
  if (!/\b(?:mirror|reflection|reflections)\b/.test(current)) {
    return "";
  }

  if (/\bbow to (?:their|the) (?:own )?reflections\b/.test(current)) {
    return [
      "Use one clear wall mirror and show the children bowing toward it after finishing the routine.",
      "Show exactly two real children and exactly two matching reflected figures, one reflection per child, with no extra mirror figures anywhere else in the room.",
      "Each reflected child must align with the matching real child in pose family, clothing, hairstyle, spacing, and left-right reversal.",
      "Do not create faint extra reflections, ghost figures, duplicate children, or background mirror copies.",
    ].join(" ");
  }

  return [
    "If a mirror is visible, every reflection must be physically correct and correspond only to the real children standing in front of it.",
    "A reflected child must have one matching real child outside the mirror with the same clothes, hairstyle, pose family, and approximate position.",
    "Mirror reflections must match the same character count, pose, clothing, spacing, and left-right reversal expected from a real mirror.",
    "Do not invent extra reflected figures, missing real children, wrong poses, impossible reflection angles, or reflections that show a different child design.",
  ].join(" ");
};

const buildPageContinuityCue = (previousPageText: string, currentPageText: string) => {
  if (!previousPageText) return "";
  const current = normalizeWhitespace(currentPageText).toLowerCase();
  const previous = normalizeWhitespace(previousPageText).toLowerCase();
  const likelySharedLocation =
    /\bmirror|studio|dance|practice room|classroom\b/.test(`${previous} ${current}`) ||
    (!/\bstreet|outside|park|bus|shops|market|home\b/.test(current) &&
      /\bmirror|studio|dance|practice room|classroom\b/.test(previous));

  return likelySharedLocation
    ? "Continuity cue: keep the same studio or practice-room location, but stage a new beat instead of repeating the previous page."
    : "";
};

const stripCoverPrefix = (value: string) =>
  value.replace(/^Children's picture-book cover illustration\.?\s*/i, "");

const sanitizeCoverScene = (value: string, state: BuilderState) => {
  if (!value) return "";
  let scene = value;
  const replacements = [
    {
      name: normalizeWhitespace(state.protagonist),
      replacement: "the protagonist",
    },
    ...(state.additionalCharacters ?? []).map((character) => {
      const role = normalizeRoleLabel(character.role);
      return {
        name: normalizeWhitespace(character.name),
        replacement: role ? `the ${role}` : "the supporting character",
      };
    }),
  ].filter((entry) => entry.name.length > 0);

  scene = scene.replace(/k-?pop\s+practice\s+(building|studio)/gi, "modern building");
  scene = scene.replace(/practice\s+(building|studio)/gi, "modern building");
  scene = scene.replace(/k-?pop\s+(building|studio)/gi, "modern building");

  replacements.forEach(({ name, replacement }) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    scene = scene.replace(new RegExp(`\\b${escaped}\\b`, "gi"), replacement);
  });

  scene = scene.replace(/:\s*and\s+/i, ": ");
  scene = scene.replace(/^\s*and\s+/i, "");
  scene = scene.replace(/\s+([,.;:])/g, "$1");
  scene = scene.replace(/\(\s*,/g, "(");
  scene = scene.replace(/,\s*\)/g, ")");
  scene = scene.replace(/\s{2,}/g, " ");
  return normalizeWhitespace(scene);
};

const buildBackCoverPrompt = (
  state: BuilderState,
  story: StoryPlan,
  imageCastLine: string,
  spreadInstruction: string,
  settings: ImageSettings,
) => {
  const setting = normalizeWhitespace(state.setting);
  const explicitContentEnabled = isExplicitContentEnabled(state);
  const coverSceneRaw = takeFirstSentences(stripCoverPrefix(story.coverPrompt), 1);
  const coverScene = sanitizeCoverScene(coverSceneRaw, state);
  const supportingActionCue =
    settings.spreadLayout === "full"
      ? explicitContentEnabled
        ? "Stage a back-cover moment that feels like the story continues beyond the front cover, with the recurring characters moving away, pausing, or exploring together in the same world."
        : "Stage a gentle back-cover moment that feels like the story continues beyond the front cover, with the children walking away, practicing, or exploring together in the same world."
      : explicitContentEnabled
        ? "Stage a back-cover moment in the same world, with the recurring characters moving away from the reader in a different but related activity."
        : "Stage a gentle back-cover moment in the same world, with the children moving away from the reader in a child-safe activity.";

  return [
    explicitContentEnabled
      ? "Illustrated narrative back cover art."
      : "Children's picture-book back cover illustration.",
    coverScene ? `Same world as the front cover: ${coverScene}` : "",
    setting ? `Keep the setting clearly in ${setting}.` : "",
    imageCastLine ? `Characters: ${imageCastLine}.` : "",
    "Show a different but related composition from the front cover, not a repeated pose or mirrored copy.",
    explicitContentEnabled
      ? "Back-cover staging: show the recurring characters from behind or in a reader-back three-quarter view, doing a story-appropriate activity that fits the world."
      : "Back-cover staging: show the recurring child or children from behind or in a reader-back three-quarter view, doing a gentle child-safe activity that fits the story world.",
    supportingActionCue,
    "Keep the same characters, clothing, proportions, palette, and art direction as the front cover.",
    buildCharacterSeparationCue(state),
    "No readable text, letters, labels, signs, logos, credits, or cover typography anywhere on the back cover.",
    `Style: ${state.artStyle}.`,
    buildPaletteLine(state.mood, state.paletteDirection),
    buildConsistencyLine(state),
    spreadInstruction,
    buildCoverAvoidLine(settings.negativePrompt, state.safetyConstraints),
  ]
    .filter((part) => part.length > 0)
    .join(" ");
};

const paletteDescriptions: Record<string, string> = {
  Playful: "bright pastel hues (mint, peach, sky blue)",
  Tender: "soft blush pink, baby blue, lavender",
  Brave: "warm coral, sunny amber, teal",
  Dreamy: "periwinkle, lilac, mint",
  Cozy: "warm honey, cocoa, olive",
  Epic: "rose, slate, golden glow",
};

const buildPaletteLine = (mood: string, paletteDirection?: string) => {
  const descriptor = paletteDescriptions[mood] ?? "soft, cohesive pastel hues";
  const custom = normalizeWhitespace(paletteDirection ?? "");
  return custom.length > 0 ? `Palette: ${custom}.` : `Palette: ${descriptor}.`;
};

const buildConsistencyLine = (state: BuilderState) => {
  const artDirection = buildArtDirectionParts(state)
    .map((part) => part.replace(/^[a-z ]+:\s*/i, ""))
    .join(", ");
  return artDirection.length > 0
    ? `Keep style, palette, line work, lighting, texture, and character designs consistent across all images: ${artDirection}.`
    : "Keep style, palette, and character designs consistent across all images.";
};

const buildCoverAvoidLine = (settingsNegative: string, safetyConstraints: string) => {
  const user = normalizeWhitespace(settingsNegative);
  const safety = normalizeWhitespace(safetyConstraints);
  const defaults = [
    "any readable text beyond the title and the exact footer credit",
    "any author names or bylines other than the exact footer credit",
    "any publisher marks or imprint logos other than the exact footer credit",
    "subtitles or taglines",
    "any extra credits or additional labels",
    "character name labels",
    "signage or building names",
    "gibberish letters or pseudo-text",
    "logos",
    "watermarks",
    "palette swatches or hex codes",
    "book frames or page borders",
    "hands holding a book",
  ];
  const parts = [user, safety, ...defaults].filter((part) => part.length > 0);
  return `Avoid: ${parts.join(", ")}.`;
};

const buildPageAvoidLine = (settingsNegative: string, safetyConstraints: string) => {
  const user = normalizeWhitespace(settingsNegative);
  const safety = normalizeWhitespace(safetyConstraints);
  const defaults = [
    "any readable text or letters",
    "signage or building names",
    "logos",
    "watermarks",
    "palette swatches or hex codes",
    "book frames or page borders",
    "hands holding a book",
  ];
  const parts = [user, safety, ...defaults].filter((part) => part.length > 0);
  return `Avoid: ${parts.join(", ")}.`;
};

const normalizeMetadataLine = (line: string) => {
  if (!line) return "";
  const cleaned = line.replace(/\s*—\s*/g, "English (US)");
  const parts = cleaned
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length >= 4) {
    const last = parts.pop();
    return `${parts.join(" / ")}, ${last}`;
  }
  return parts.join(" / ");
};

const describeAdditionalCharacter = (character: AdditionalCharacter) => {
  const name = normalizeWhitespace(character.name);
  const role = normalizeWhitespace(character.role);
  const creature = normalizeWhitespace(character.creatureType);
  const genderRaw = normalizeWhitespace(character.gender);
  const gender =
    genderRaw.length > 0
      ? genderRaw.toLowerCase() === "none"
        ? "gender: none"
        : `gender: ${genderRaw.toLowerCase()}`
      : "";
  const details = [role, creature, gender].filter((part) => part.length > 0).join(", ");

  if (name && details) {
    return `${name} (${details})`;
  }
  if (name) {
    return name;
  }
  return details;
};

const buildCastFromState = (state: BuilderState) => {
  const extraCharacters = (state.additionalCharacters ?? [])
    .map(describeAdditionalCharacter)
    .filter((name) => name.length > 0);
  const castList = [state.protagonist.trim(), ...extraCharacters].filter(
    (value) => value.length > 0,
  );
  return {
    castList,
    castLine: formatCastList(castList),
    extraCharacters,
  };
};

const isExplicitContentEnabled = (state: Pick<BuilderState, "explicitContentEnabled" | "ageBand">) =>
  state.explicitContentEnabled || normalizeWhitespace(state.ageBand) === adultAgeBand;

const getAgeBandOptions = (state: Pick<BuilderState, "explicitContentEnabled" | "ageBand">) =>
  isExplicitContentEnabled(state) ? [...ageBands, adultAgeBand] : ageBands;

const getStoryAudienceLabel = (state: Pick<BuilderState, "explicitContentEnabled" | "ageBand">) =>
  isExplicitContentEnabled(state) ? "mature illustrated story" : "children's picture-book";

const getStoryPlannerRoleLine = (state: Pick<BuilderState, "explicitContentEnabled" | "ageBand">) =>
  isExplicitContentEnabled(state)
    ? "You are a fiction story planner for mature or all-ages illustrated stories."
    : "You are a children's story planner.";

const getDraftAudienceGuardrailLine = (
  state: Pick<BuilderState, "explicitContentEnabled" | "ageBand">,
) =>
  isExplicitContentEnabled(state)
    ? "Mature content is allowed when it is explicitly requested in the premise. Do not automatically sanitize violence, sexual content, or other adult themes, but keep the output coherent, intentional, and aligned with the request."
    : "Keep the material safe, warm, and suitable for children.";

const getFinalAudienceGuardrailLine = (
  state: Pick<BuilderState, "explicitContentEnabled" | "ageBand">,
) =>
  isExplicitContentEnabled(state)
    ? "Adult content is permitted when the story premise clearly calls for it. Do not add child-safety softening unless the user asks for it."
    : "Keep the tone safe and warm for children.";

const buildImageCastLine = (state: BuilderState) => {
  const protagonistGender = normalizeGenderLabel(state.protagonistGender);
  const protagonistCreature = normalizeWhitespace(state.creatureType).toLowerCase();
  const protagonistParts = [
    protagonistGender,
    protagonistCreature || "child",
    "protagonist",
  ].filter((part) => part.length > 0);
  const protagonistDescriptor = protagonistParts.join(" ");

  const extraDescriptors = (state.additionalCharacters ?? [])
    .map((character) => {
      const role = normalizeRoleLabel(character.role) || "supporting character";
      const gender = normalizeGenderLabel(character.gender);
      const creature = normalizeWhitespace(character.creatureType).toLowerCase();
      const parts = [gender, creature || "character", role].filter((part) => part.length > 0);
      return parts.join(" ");
    })
    .filter((value) => value.length > 0);

  return [protagonistDescriptor, ...extraDescriptors].filter((value) => value.length > 0).join(" and ");
};

const toSlugToken = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildContinuityToken = (state: BuilderState, story: StoryPlan) => {
  const token = toSlugToken(
    `${story.title} ${state.protagonist} ${state.setting} ${state.artStyle}`,
  );
  return token.length > 0 ? token.slice(0, 64) : "storybook-continuity";
};

const buildStyleLock = (state: BuilderState, castLine: string) => {
  const userLock = normalizeWhitespace(state.illustrationConsistency);
  const protagonist = state.protagonist.trim();
  const creatureType = normalizeWhitespace(state.creatureType);
  const creatureDescriptor = creatureType
    ? /^(a|an)\s+/i.test(creatureType)
      ? creatureType
      : `a ${creatureType}`
    : "";
  const protagonistGender = normalizeWhitespace(state.protagonistGender);
  const genderDescriptor =
    protagonistGender.length > 0
      ? protagonistGender.toLowerCase() === "none"
        ? "gender: none"
        : `gender: ${protagonistGender.toLowerCase()}`
      : "";
  const protagonistTrait = state.protagonistTrait.trim();
  const traitLabel = formatTraitLabel(protagonistTrait);
  const setting = state.setting.trim();
  const artStyle = state.artStyle.trim().toLowerCase();
  const artDirection = buildArtDirectionParts(state);
  const characterSeparationCue = buildCharacterSeparationCue(state);
  const audienceLabel = isExplicitContentEnabled(state)
    ? "illustrated narrative rendering"
    : "children's picture-book rendering";

  return [
    `${artStyle} ${audienceLabel} with consistent brush texture`,
    ...artDirection,
    creatureDescriptor
      ? protagonist
        ? `${protagonist} is ${creatureDescriptor}; keep species traits consistent across all scenes`
        : `lead character is ${creatureDescriptor}; keep species traits consistent across all scenes`
      : "",
    protagonist
      ? `${protagonist}: same face shape, hairstyle, outfit silhouette, and color palette in all scenes`
      : "",
    traitLabel
      ? protagonist
        ? `show ${protagonist}'s ${traitLabel} through body language, not by changing design`
        : `show the lead character's ${traitLabel} through body language, not by changing design`
      : "",
    setting ? `preserve recurring visual anchors from ${setting}` : "",
    castLine ? `all scenes must depict the same cast identity: ${castLine}` : "",
    characterSeparationCue,
    userLock,
    "keep exact same character model sheets, outfit colors, proportions, and facial features on every page",
    "no visible typography or readable letters inside the illustration",
  ]
    .filter((part) => part.length > 0)
    .join("; ");
};

const buildNegativePrompt = (
  settingsNegative: string,
  safetyConstraints: string,
  explicitContentEnabled = false,
) => {
  const userNegative = normalizeWhitespace(settingsNegative);
  const safety = normalizeWhitespace(safetyConstraints);
  const defaults = [
    "readable text",
    "letters",
    "typography",
    "logo",
    "watermark",
    "signature",
    ...(explicitContentEnabled ? [] : ["gore", "horror", "weapon focus"]),
    "3d render look",
    "extra limbs",
    "deformed hands",
    "blurry low-detail output",
  ];
  return [userNegative, safety, ...defaults].filter((part) => part.length > 0).join(", ");
};

const buildStoryPlan = (state: BuilderState): StoryPlan => {
  const explicitContentEnabled = isExplicitContentEnabled(state);
  const themeText = state.theme.trim();
  const protagonist = state.protagonist.trim();
  const creatureType = normalizeWhitespace(state.creatureType);
  const creatureDescriptor = creatureType
    ? /^(a|an)\s+/i.test(creatureType)
      ? creatureType
      : `a ${creatureType}`
    : "";
  const protagonistGender = normalizeWhitespace(state.protagonistGender);
  const genderDescriptor =
    protagonistGender.length > 0
      ? protagonistGender.toLowerCase() === "none"
        ? "gender: none"
        : `gender: ${protagonistGender.toLowerCase()}`
      : "";
  const protagonistTrait = state.protagonistTrait.trim();
  const protagonistTraitLabel = formatTraitLabel(protagonistTrait);
  const { castLine, extraCharacters } = buildCastFromState(state);
  const imageCastLine = buildImageCastLine(state);
  const setting = state.setting.trim();
  const lesson = state.themeLesson.trim();
  const narrativeStyle = state.narrativeStyle.trim();
  const endingType = state.endingType.trim();
  const language = state.language.trim();
  const conflictType = state.conflictType.trim();
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
  const canBuildIllustrationNotes = Boolean(artLabel) && Boolean(setting);
  const canBuildCoverPrompt =
    Boolean(artLabel) &&
    Boolean(castLine) &&
    Boolean(setting) &&
    Boolean(language);
  const styleLock = buildStyleLock(state, castLine);

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
    metadataLine: `${state.ageBand} / ${state.genre} / ${state.artStyle}, ${language || "English (US)"}`,
    synopsis: canBuildSynopsis
      ? `${spreadCount}-spread ${narrativeStyle.toLowerCase()} draft in ${language}. ${castLine} move through a ${toneLabel} ${genreLabel} set in ${setting.toLowerCase()}, using "${leadIdea}" to land ${lesson.toLowerCase()} with a ${endingType.toLowerCase()} ending.`
      : "",
    openingLine: canBuildOpeningLine
      ? explicitContentEnabled
        ? `In ${setting.toLowerCase()}, ${protagonist}${
            creatureDescriptor ? `, ${creatureDescriptor}` : ""
          }${genderDescriptor ? `, ${genderDescriptor}` : ""}${
            protagonistTraitLabel ? ` carried their ${protagonistTraitLabel}` : ""
          } into the moment everything began to shift.`
        : `In ${setting.toLowerCase()}, ${protagonist}${
            creatureDescriptor ? `, ${creatureDescriptor}` : ""
          }${genderDescriptor ? `, ${genderDescriptor}` : ""}${
            protagonistTraitLabel ? ` kept their ${protagonistTraitLabel} hidden` : ""
          } until the morning the sky forgot how to whisper.`
      : "",
    coverPrompt: canBuildCoverPrompt
      ? `${
          explicitContentEnabled
            ? "Illustrated story cover scene."
            : "Children's picture-book cover illustration."
        }${setting ? ` Scene in ${setting}.` : ""}${
          imageCastLine ? ` Characters: ${imageCastLine}.` : ""
        } Style: ${state.artStyle}. Composition: ${
          explicitContentEnabled
            ? "emotionally clear cover focus with one memorable focal action"
            : "child-safe cover focus with one memorable focal action"
        }. No visible text or letters in artwork.`
      : "",
    palette: colorPalettes[state.mood] ?? colorPalettes.Dreamy,
    storyBeats: canBuildBeats
      ? [
          `Open in ${setting.toLowerCase()} and establish that ${lowerLeadIdea}.`,
          `${protagonist} faces the ${conflictType.toLowerCase()} as it escalates${
            protagonistTraitLabel ? `, testing their ${protagonistTraitLabel}` : ""
          }.`,
          `A midpoint turn reframes the story around ${lesson.toLowerCase()} while preserving a ${narrativeStyle.toLowerCase()} reading rhythm.`,
          `${protagonist} takes action that resolves the ${conflictType.toLowerCase()} instead of avoiding it.`,
          `Close with a ${endingType.toLowerCase()} ending that makes the change visible on the final spread.`,
        ]
      : [],
    illustrationNotes: canBuildIllustrationNotes
      ? [
          `Maintain ${artLabel} rendering with strict continuity: ${styleLock}.`,
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
  const explicitContentEnabled = isExplicitContentEnabled(state);
  const protagonist = state.protagonist.trim();
  const creatureType = normalizeWhitespace(state.creatureType);
  const creatureDescriptor = creatureType
    ? /^(a|an)\s+/i.test(creatureType)
      ? creatureType
      : `a ${creatureType}`
    : "";
  const protagonistGender = normalizeWhitespace(state.protagonistGender);
  const genderDescriptor =
    protagonistGender.length > 0
      ? protagonistGender.toLowerCase() === "none"
        ? "gender: none"
        : `gender: ${protagonistGender.toLowerCase()}`
      : "";
  const protagonistTrait = state.protagonistTrait.trim();
  const { castLine, extraCharacters } = buildCastFromState(state);
  const imageCastLine = buildImageCastLine(state);
  const extraCastLabel = extraCharacters.join(", ");
  const setting = state.setting.trim();
  const language = state.language.trim() || "English (US)";
  const artLabel = state.artStyle.toLowerCase();
  const bookSize = getBookSize(settings.bookSize);
  const styleLock = buildStyleLock(state, castLine);
  const continuityToken = buildContinuityToken(state, story);
  const negativePrompt = buildNegativePrompt(
    settings.negativePrompt,
    state.safetyConstraints,
    explicitContentEnabled,
  );
  const characterPromptNotes = settings.characterPromptNotes.trim();
  const scenePromptNotes = settings.scenePromptNotes.trim();
  const spreadInstruction =
    settings.spreadLayout === "full" ? "Full spread image." : "Split left/right spread.";
  const sceneLabel = explicitContentEnabled
    ? "illustrated narrative scene"
    : `${artLabel} storybook scene`;
  const moodGuardrail = explicitContentEnabled
    ? "match the requested mature tone, no readable text"
    : "child-safe mood, no readable text";
  const coverSceneRaw = takeFirstSentences(stripCoverPrefix(story.coverPrompt), 1);
  const coverScene = sanitizeCoverScene(coverSceneRaw, state);
  const coverPrompt = [
    explicitContentEnabled
      ? "Illustrated story cover art."
      : "Children's picture-book cover illustration.",
    coverScene,
    imageCastLine ? `Characters: ${imageCastLine}.` : "",
    buildCharacterSeparationCue(state),
    buildCoverTypographyLayoutLine(story.title),
    `Do not add any other readable text, letters, labels, names, or credits anywhere on the cover (buildings, clothing, signs, props).`,
    `Style: ${state.artStyle}.`,
    buildPaletteLine(state.mood, state.paletteDirection),
    buildConsistencyLine(state),
    spreadInstruction,
    buildCoverAvoidLine(settings.negativePrompt, state.safetyConstraints),
  ]
    .filter((part) => part.length > 0)
    .join(" ");
  const backCoverPrompt = buildBackCoverPrompt(
    state,
    story,
    imageCastLine,
    spreadInstruction,
    settings,
  );
  const palette = story.palette.length > 0 ? story.palette : ["#7468ff", "#5f52f3", "#38bdf8"];
  const protagonistPromptParts = [
    artLabel ? `${artLabel} character sheet for picture-book consistency` : "",
    protagonist,
    creatureDescriptor ? `creature type ${creatureDescriptor}` : "",
    genderDescriptor ? `${genderDescriptor}` : "",
    protagonistTrait ? protagonistTrait.toLowerCase() : "",
    setting ? `from ${setting}` : "",
    "front view",
    "three-quarter view",
    "expression sheet",
    "pose sheet",
    `continuity token ${continuityToken}`,
    styleLock,
    characterPromptNotes,
    language,
    "no readable text in the artwork",
    `negative prompt: ${negativePrompt}`,
  ].filter((part) => part.length > 0);
  const supportPromptParts = [
    artLabel ? `${artLabel} supporting cast character sheet` : "",
    extraCastLabel,
    setting ? `from ${setting}` : "",
    protagonist ? `grouped with ${protagonist} for scale` : "",
    `continuity token ${continuityToken}`,
    styleLock,
    characterPromptNotes,
    language,
    "no readable text in the artwork",
    `negative prompt: ${negativePrompt}`,
  ].filter((part) => part.length > 0);

  return {
    packageLine: `${bookSize.shortLabel} / ${settings.aspectRatio} / ${settings.imageSize} / ${settings.variationCount} variations`,
    effectiveNegativePrompt: negativePrompt,
    styleLock,
    continuityToken,
    castLine: imageCastLine,
    palette,
    coverPrompt,
    backCoverPrompt,
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
        prompt: [
          sceneLabel,
          `continuity token ${continuityToken}`,
          story.storyBeats[0] ?? "",
          setting ? `set in ${setting}` : "",
          `style lock: ${styleLock}`,
          `layout: ${spreadInstruction}`,
          moodGuardrail,
          scenePromptNotes,
          `${bookSize.shortLabel} / ${settings.aspectRatio} / ${settings.imageSize}`,
          `negative prompt: ${negativePrompt}`,
        ]
          .filter((part) => part.length > 0)
          .join(", "),
      },
      {
        title: "Midpoint keyframe",
        detail: "story turn",
        prompt: [
          sceneLabel,
          `continuity token ${continuityToken}`,
          story.storyBeats[2] ?? "",
          "cinematic story spread with readable silhouettes",
          `style lock: ${styleLock}`,
          `layout: ${spreadInstruction}`,
          moodGuardrail,
          scenePromptNotes,
          `${bookSize.shortLabel} / ${settings.aspectRatio} / ${settings.imageSize}`,
          `negative prompt: ${negativePrompt}`,
        ]
          .filter((part) => part.length > 0)
          .join(", "),
      },
      {
        title: "Final spread keyframe",
        detail: "resolution image",
        prompt: [
          explicitContentEnabled ? "illustrated narrative finale" : `${artLabel} final story spread`,
          `continuity token ${continuityToken}`,
          story.storyBeats[4] ?? "",
          "calm closing tableau",
          `style lock: ${styleLock}`,
          `layout: ${spreadInstruction}`,
          moodGuardrail,
          scenePromptNotes,
          `${bookSize.shortLabel} / ${settings.aspectRatio} / ${settings.imageSize}`,
          `negative prompt: ${negativePrompt}`,
        ]
          .filter((part) => part.length > 0)
          .join(", "),
      },
    ],
    assetCards: [
      {
        title: "Cover set",
        kind: `${settings.variationCount} cover variants`,
        note: settings.coverFocus,
        detail: `${settings.aspectRatio} / ${settings.imageSize}`,
        gradient: buildGradient(palette[0], palette[1] ?? palette[0]),
        featured: true,
      },
      {
        title: `${protagonist || "Main character"} model sheet`,
        kind: "Character reference",
        note: protagonistTrait,
        detail: `${state.artStyle} / ${language}`,
        gradient: buildGradient(palette[1] ?? palette[0], palette[2] ?? palette[0]),
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
  allPages: string[],
  state: BuilderState,
  image: ImagePlan,
  settings: ImageSettings,
) => {
  const spreadCount = Math.max(6, Math.min(16, state.spreads));
  const explicitContentEnabled = isExplicitContentEnabled(state);
  const geometry = getStepGeometry(settings, { kind: "page" });
  const currentPageLower = normalizeWhitespace(pageText).toLowerCase();
  const spreadLayoutInstruction =
    settings.spreadLayout === "full"
      ? `Render one clean wide full-bleed illustration composed for a ${geometry.trimLabel} interior layout, but output only the painted scene art with no visible book object.`
      : "Render a clean left-right interior illustration layout, but output only the painted scene art with no visible book object.";
  const setting = state.setting.trim();
  const previousPageText = pageIndex > 0 ? allPages[pageIndex - 1] ?? "" : "";
  const storyMoment = buildLiteralPageBrief(pageText, state, previousPageText);
  const continuityCue = buildPageContinuityCue(previousPageText, pageText);
  const visualAnchors = inferPageVisualAnchors(pageText, previousPageText);
  const sceneLogicCue = buildSceneLogicCue(pageText, previousPageText);
  const stagingCue = buildPageStagingCue(pageText, previousPageText);
  const characterIntegrityCue = buildCharacterIntegrityCue(state, pageText, previousPageText);
  const mirrorIntegrityCue = buildMirrorIntegrityCue(pageText, previousPageText);

  return [
    explicitContentEnabled
      ? `Illustrated narrative scene for page ${pageIndex + 1} of ${spreadCount}.`
      : `Children's picture-book illustration for page ${pageIndex + 1} of ${spreadCount}.`,
    "Use the provided reference image or images as the source of truth for the same characters, palette, line work, proportions, and overall art direction.",
    "Use the reference images only for style and character continuity. Ignore any cover text, footer credit, borders, margins, seams, gutters, page edges, or book-object presentation visible in the references.",
    storyMoment ? `Literal scene brief: ${storyMoment}.` : "",
    continuityCue,
    visualAnchors,
    sceneLogicCue,
    stagingCue,
    characterIntegrityCue,
    mirrorIntegrityCue,
    setting ? `Overall setting: ${setting}.` : "",
    image.castLine ? `Keep the same cast from the cover: ${image.castLine}.` : "",
    /\bbow to (?:their|the) (?:own )?reflections\b/.test(currentPageLower)
      ? "Translate this page into one clean final-practice moment: two children finishing the routine, giving small bows toward a single wall mirror, with calm proud expressions."
      : "Translate the story prose into specific physical details: location, props, body positions, expressions, and background action.",
    "Prefer a physically believable, reader-friendly composition over a dramatic but unrealistic one.",
    explicitContentEnabled
      ? "Allow mature staging only when it is clearly supported by the story text, and keep the composition coherent, physically believable, and intentional."
      : "All actions and staging must model safe, age-appropriate behavior for a children's picture book.",
    `Target page geometry: ${geometry.trimLabel}, ${geometry.aspectRatioLabel}.`,
    spreadLayoutInstruction,
    "Illustration only, not a photo of a book, printed page, cover, poster, or mockup.",
    "Do not literalize metaphors, idioms, or poetic phrases as physical objects.",
    "Avoid duplicate characters, wrong reflections, missing cast members, impossible mirror images, back-facing main figures, and repeated cover-like staging when the page action is different.",
    "No readable text, no dialogue, no speech bubbles, no captions, no hands, no page borders, no book mockup, no open-book view, no center gutter, no spine, no visible page seam, no paper edge, and no drop-shadowed page frame.",
  ]
    .filter((part) => part.length > 0)
    .join(" ");
};

const buildImageSteps = (
  state: BuilderState,
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
    {
      id: "back-cover",
      label: "Back cover",
      kind: "back_cover",
      prompt: image.backCoverPrompt,
    },
  ];

  if (finalStory?.pages?.length) {
    finalStory.pages.slice(0, spreadCount).forEach((pageText, index) => {
      steps.push({
        id: `page-${index + 1}`,
        label: `Page ${index + 1}`,
        kind: "page",
        prompt: buildPagePrompt(pageText, index, finalStory.pages, state, image, settings),
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

const isAuthSessionValid = (session: AuthSessionSnapshot | null) =>
  Boolean(
    session &&
      session.version === authSessionVersion &&
      session.token.trim().length > 0 &&
      session.username.trim().length > 0 &&
      Number.isFinite(session.expiresAt) &&
      session.expiresAt > Date.now(),
  );

const parseStoredAuthSession = (raw: string | null): AuthSessionSnapshot | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthSessionSnapshot> | null;
    if (!parsed) return null;
    const session: AuthSessionSnapshot = {
      version:
        typeof parsed.version === "number" ? parsed.version : 0,
      token: typeof parsed.token === "string" ? parsed.token : "",
      username: typeof parsed.username === "string" ? parsed.username : "",
      userId: typeof parsed.userId === "number" ? parsed.userId : 0,
      expiresAt: typeof parsed.expiresAt === "number" ? parsed.expiresAt : 0,
    };
    return isAuthSessionValid(session) ? session : null;
  } catch {
    return null;
  }
};

const normalizeAuthSession = (
  session: Omit<AuthSessionSnapshot, "version"> & Partial<Pick<AuthSessionSnapshot, "version">>,
): AuthSessionSnapshot => ({
  version: authSessionVersion,
  token: session.token,
  username: session.username,
  userId: session.userId,
  expiresAt: session.expiresAt,
});

const getRegistrationPasswordMessage = (password: string) => {
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9\s]/.test(password);

  if (password.length < 8 || password.length > 128) {
    return "Password must be between 8 and 128 characters.";
  }
  if (!hasUpper || !hasLower || !hasDigit || !hasSymbol) {
    return "Password must include uppercase, lowercase, number, and symbol characters.";
  }
  return null;
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
  if (Array.isArray(data) && data[0]) {
    const entry = data[0] as { url?: unknown; b64_json?: unknown };
    if (typeof entry.url === "string") {
      return entry.url;
    }
    if (typeof entry.b64_json === "string") {
      return `data:image/png;base64,${entry.b64_json}`;
    }
  }
  const predictions = (payload as { predictions?: unknown }).predictions;
  if (Array.isArray(predictions) && predictions[0]) {
    const prediction = predictions[0] as {
      bytesBase64Encoded?: unknown;
      imageBytes?: unknown;
      image?: { bytesBase64Encoded?: unknown; imageBytes?: unknown };
    };
    const bytes =
      (typeof prediction.bytesBase64Encoded === "string" &&
        prediction.bytesBase64Encoded) ||
      (typeof prediction.imageBytes === "string" && prediction.imageBytes) ||
      (typeof prediction.image?.bytesBase64Encoded === "string" &&
        prediction.image.bytesBase64Encoded) ||
      (typeof prediction.image?.imageBytes === "string" && prediction.image.imageBytes) ||
      null;
    if (bytes) {
      return `data:image/png;base64,${bytes}`;
    }
  }
  return null;
};

const loadImageElement = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image load failed"));
    image.src = src;
  });

const slugifyFileName = (value: string, fallback = "mary-ann-stories-book") => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : fallback;
};

const beginRoundedRectPath = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
};

const wrapCanvasText = (
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) => {
  const paragraphs = text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
  const lines: string[] = [];

  for (const [index, paragraph] of paragraphs.entries()) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let currentLine = "";
    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (context.measureText(candidate).width <= maxWidth || currentLine.length === 0) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    if (index < paragraphs.length - 1) {
      lines.push("");
    }
  }

  return lines;
};

const drawImageCover = (
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  targetWidth: number,
  targetHeight: number,
) => {
  const sourceWidth =
    image instanceof HTMLImageElement ? image.naturalWidth || image.width : targetWidth;
  const sourceHeight =
    image instanceof HTMLImageElement ? image.naturalHeight || image.height : targetHeight;
  if (!sourceWidth || !sourceHeight) return;

  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (sourceRatio > targetRatio) {
    cropWidth = sourceHeight * targetRatio;
    offsetX = (sourceWidth - cropWidth) / 2;
  } else if (sourceRatio < targetRatio) {
    cropHeight = sourceWidth / targetRatio;
    offsetY = (sourceHeight - cropHeight) / 2;
  }

  context.drawImage(
    image,
    offsetX,
    offsetY,
    cropWidth,
    cropHeight,
    0,
    0,
    targetWidth,
    targetHeight,
  );
};

const fetchImageAsObjectUrl = async (src: string) => {
  const isRemote = src.startsWith("http://") || src.startsWith("https://");
  const response = await fetch(
    isRemote
      ? isBackendImageProxyUrl(src)
        ? src
        : `${apiBaseUrl}/api/images/proxy`
      : src,
    isRemote
      ? isBackendImageProxyUrl(src)
        ? {
            credentials: "include",
          }
        : {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ url: src }),
          }
      : undefined,
  );
  if (!response.ok) {
    let detail = "";
    try {
      const data = (await response.json()) as { error?: string; detail?: string };
      detail = data.detail ?? data.error ?? "";
    } catch {
      detail = "";
    }
    throw new Error(
      `Image fetch failed: ${response.status}${detail ? ` (${detail})` : ""}`,
    );
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

const fetchImageAsDataUrl = async (src: string) => {
  if (src.startsWith("data:")) {
    return src;
  }

  const isRemote = src.startsWith("http://") || src.startsWith("https://");
  const response = await fetch(
    isRemote
      ? isBackendImageProxyUrl(src)
        ? src
        : `${apiBaseUrl}/api/images/proxy`
      : src,
    isRemote
      ? isBackendImageProxyUrl(src)
        ? {
            credentials: "include",
          }
        : {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ url: src }),
          }
      : undefined,
  );
  if (!response.ok) {
    let detail = "";
    try {
      const data = (await response.json()) as { error?: string; detail?: string };
      detail = data.detail ?? data.error ?? "";
    } catch {
      detail = "";
    }
    throw new Error(
      `Image fetch failed: ${response.status}${detail ? ` (${detail})` : ""}`,
    );
  }

  return blobToDataUrl(await response.blob());
};

const readImageMetrics = async (src: string) => {
  const objectUrl = src.startsWith("data:") ? null : await fetchImageAsObjectUrl(src);
  try {
    const image = await loadImageElement(objectUrl ?? src);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    return {
      width,
      height,
      aspectRatio: width > 0 && height > 0 ? width / height : 0,
    };
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
};

const normalizeImageQaResponse = (
  payload: ImageQaResponse | null,
): Pick<ImageQaReport, "summary" | "issues"> => ({
  summary:
    typeof payload?.summary === "string"
      ? payload.summary
      : "Automated QA finished with no additional summary.",
  issues: Array.isArray(payload?.issues)
    ? payload.issues
        .filter(
          (issue): issue is NonNullable<ImageQaResponse["issues"]>[number] =>
            Boolean(issue) &&
            typeof issue === "object" &&
            typeof issue.id === "string" &&
            typeof issue.label === "string" &&
            typeof issue.detail === "string" &&
            (issue.severity === "warning" || issue.severity === "blocker"),
        )
        .map((issue) => ({
          id: issue.id!,
          label: issue.label!,
          detail: issue.detail!,
          severity: issue.severity!,
        }))
    : [],
});

const normalizeImageToGeometry = async (
  src: string,
  geometry: StepGeometry,
) => {
  const targetWidth = Math.max(1, geometry.pixelWidth);
  const targetHeight = Math.max(1, geometry.pixelHeight);
  const targetRatio = targetWidth / targetHeight;
  const objectUrl = src.startsWith("data:")
    ? null
    : await fetchImageAsObjectUrl(src);

  try {
    const image = await loadImageElement(objectUrl ?? src);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) {
      return src;
    }

    const sourceRatio = sourceWidth / sourceHeight;
    let cropWidth = sourceWidth;
    let cropHeight = sourceHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (Math.abs(sourceRatio - targetRatio) > 0.001) {
      if (sourceRatio > targetRatio) {
        cropWidth = Math.round(sourceHeight * targetRatio);
        offsetX = Math.max(0, Math.round((sourceWidth - cropWidth) / 2));
      } else {
        cropHeight = Math.round(sourceWidth / targetRatio);
        offsetY = Math.max(0, Math.round((sourceHeight - cropHeight) / 2));
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      return src;
    }

    context.drawImage(
      image,
      offsetX,
      offsetY,
      cropWidth,
      cropHeight,
      0,
      0,
      targetWidth,
      targetHeight,
    );

    return canvas.toDataURL("image/png");
  } catch {
    return src;
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
};

const prepareReferenceImageForGeneration = async (
  reference: ReferenceImageSource,
) => {
  const objectUrl = reference.src.startsWith("data:")
    ? null
    : await fetchImageAsObjectUrl(reference.src);

  try {
    const image = await loadImageElement(objectUrl ?? reference.src);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) {
      return reference.src;
    }

    const canvas = document.createElement("canvas");
    let insetX = Math.round(sourceWidth * 0.03);
    let insetTop = Math.round(sourceHeight * 0.03);
    let insetBottom = Math.round(sourceHeight * 0.03);

    if (reference.kind === "cover") {
      insetX = Math.round(sourceWidth * 0.04);
      insetTop = Math.round(sourceHeight * 0.16);
      insetBottom = Math.round(sourceHeight * 0.12);
    }

    const cropX = Math.max(0, insetX);
    const cropY = Math.max(0, insetTop);
    const cropWidth = Math.max(1, sourceWidth - cropX * 2);
    const cropHeight = Math.max(1, sourceHeight - cropY - insetBottom);

    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      return reference.src;
    }

    context.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight,
    );

    return canvas.toDataURL("image/png");
  } catch {
    return reference.src;
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
};

const buildDraftPrompt = (state: BuilderState, plan: StoryPlan) => {
  const { castLine } = buildCastFromState(state);
  const spreadCount = Math.max(6, Math.min(16, state.spreads));
  const artDirection = buildArtDirectionParts(state).join("; ");

  return [
    getStoryPlannerRoleLine(state),
    "Return JSON only with these keys: title, metadataLine, synopsis, openingLine, coverPrompt, palette, storyBeats, illustrationNotes.",
    "palette must be 3-5 hex colors. storyBeats must be 5 items. illustrationNotes must be 4-6 items.",
    `coverPrompt must be 1-2 concise sentences describing a concrete visual scene with character appearance anchors for consistency across pages. Do not use character names or theme/lesson language; avoid brand-specific venues and any signage text. Match the requested audience and content level for a ${getStoryAudienceLabel(
      state,
    )}.`,
    "Each story beat must be grammatical and specific. Avoid broken phrasing or malformed sentences.",
    "illustrationNotes must include continuity rules: same character design, same outfit colors, same art medium, and no readable text in images.",
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
    `Creature type (protagonist): ${state.creatureType || "not specified"}`,
    `Illustration style: ${state.artStyle}`,
    `Visual preset: ${getVisualPreset(state.visualPreset).label}`,
    ...(artDirection ? [`Art direction: ${artDirection}`] : []),
    `Illustration consistency: ${state.illustrationConsistency}`,
    `Safety constraints: ${state.safetyConstraints}`,
    getDraftAudienceGuardrailLine(state),
    `Spreads: ${spreadCount}`,
    `Draft context: ${plan.synopsis}`,
    "Respond with JSON only. No markdown.",
  ].join("\n");
};

const buildFinalPrompt = (state: BuilderState, plan: StoryPlan) => {
  const spreadCount = Math.max(6, Math.min(16, state.spreads));
  const beats = plan.storyBeats.map((beat, index) => `${index + 1}. ${beat}`).join(" ");
  const { extraCharacters } = buildCastFromState(state);

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
    `Characters: ${state.protagonist}${
      extraCharacters.length > 0 ? `, ${extraCharacters.join(", ")}` : ""
    }`,
    `Creature type (protagonist): ${state.creatureType || "not specified"}`,
    `Safety constraints: ${state.safetyConstraints}`,
    `Story beats: ${beats}`,
    getFinalAudienceGuardrailLine(state),
    "Respond with JSON only. No markdown.",
  ].join("\n");
};

const toOpenAiImageSize = (ratioLabel: string) => {
  const normalized = ratioLabel.toLowerCase();
  if (
    normalized.includes("landscape") ||
    normalized.includes("cinematic") ||
    normalized.includes("spread")
  ) {
    return "1792x1024";
  }
  if (normalized.includes("portrait") || normalized.includes("cover")) {
    return "1024x1792";
  }
  return "1024x1024";
};

const parseImageSizePixels = (label: string) => {
  const match = label.match(/(\d+)/);
  const parsed = match ? Number.parseInt(match[1] ?? "", 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1536;
};

const gcd = (left: number, right: number): number => {
  let a = Math.abs(Math.round(left));
  let b = Math.abs(Math.round(right));
  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a || 1;
};

const formatRatioLabel = (width: number, height: number, suffix = "") => {
  const divisor = gcd(width, height);
  const reducedWidth = Math.round(width / divisor);
  const reducedHeight = Math.round(height / divisor);
  return `${reducedWidth}:${reducedHeight}${suffix ? ` ${suffix}` : ""}`;
};

const getStepGeometry = (
  settings: ImageSettings,
  step: Pick<ImageStep, "kind"> | null,
): StepGeometry => {
  const bookSize = getBookSize(settings.bookSize);
  const basePixels = parseImageSizePixels(settings.imageSize);
  const isCover = !step || step.kind === "cover" || step.kind === "back_cover";
  const isFullSpread = settings.spreadLayout === "full";

  if (isCover) {
    const scale = basePixels / bookSize.height;
    const pixelWidth = Math.round(bookSize.width * scale);
    const pixelHeight = Math.round(bookSize.height * scale);
    return {
      aspectRatioLabel: bookSize.aspectRatio,
      outputSizeLabel: settings.imageSize,
      openAiSize: toOpenAiImageSize(bookSize.aspectRatio),
      trimLabel: `${bookSize.shortLabel} cover`,
      width: bookSize.width,
      height: bookSize.height,
      pixelWidth,
      pixelHeight,
      pixelSizeLabel: `${pixelWidth} x ${pixelHeight} px`,
    };
  }

  const spreadWidth = isFullSpread ? bookSize.width * 2 : bookSize.width;
  const spreadHeight = bookSize.height;
  const spreadSuffix = isFullSpread ? "spread" : "page";
  const spreadRatio = formatRatioLabel(spreadWidth, spreadHeight, spreadSuffix);
  const spreadScale = basePixels / bookSize.height;
  const pixelWidth = Math.round(spreadWidth * spreadScale);
  const pixelHeight = Math.round(spreadHeight * spreadScale);

  return {
    aspectRatioLabel: spreadRatio,
    outputSizeLabel: settings.imageSize,
    openAiSize: toOpenAiImageSize(`${spreadRatio} landscape`),
    trimLabel: isFullSpread
      ? `${bookSize.width * 2}x${bookSize.height} spread`
      : `${bookSize.shortLabel} page`,
    width: spreadWidth,
    height: spreadHeight,
    pixelWidth,
    pixelHeight,
    pixelSizeLabel: `${pixelWidth} x ${pixelHeight} px`,
  };
};

const getBookLayoutGeometry = (settings: ImageSettings): StepGeometry => {
  const bookSize = getBookSize(settings.bookSize);
  const basePixels = parseImageSizePixels(settings.imageSize);
  const spreadWidth = bookSize.width * 2;
  const spreadHeight = bookSize.height;
  const spreadScale = basePixels / bookSize.height;
  const pixelWidth = Math.round(spreadWidth * spreadScale);
  const pixelHeight = Math.round(spreadHeight * spreadScale);
  const spreadRatio = formatRatioLabel(spreadWidth, spreadHeight, "spread");

  return {
    aspectRatioLabel: spreadRatio,
    outputSizeLabel: settings.imageSize,
    openAiSize: toOpenAiImageSize(`${spreadRatio} landscape`),
    trimLabel: `${spreadWidth}x${spreadHeight} spread`,
    width: spreadWidth,
    height: spreadHeight,
    pixelWidth,
    pixelHeight,
    pixelSizeLabel: `${pixelWidth} x ${pixelHeight} px`,
  };
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
  const [authSession, setAuthSession] = createSignal<AuthSessionSnapshot | null>(null);
  const [authReady, setAuthReady] = createSignal(false);
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
  const [resetImagesConfirmOpen, setResetImagesConfirmOpen] = createSignal(false);
  const [resetImagesBusy, setResetImagesBusy] = createSignal(false);
  const [resetImagesError, setResetImagesError] = createSignal<string | null>(null);
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
  const [homeShelfTab, setHomeShelfTab] = createSignal<HomeShelfTab>("private");
  const [publishedStoryArchives, setPublishedStoryArchives] = createSignal<StoryDeskEntry[]>([]);
  const [publishedStoryPage, setPublishedStoryPage] = createSignal(0);
  const [publishedStoryHasMore, setPublishedStoryHasMore] = createSignal(true);
  const [publishedStoryLoading, setPublishedStoryLoading] = createSignal(false);
  const [publishedStoryError, setPublishedStoryError] = createSignal<string | null>(null);
  const [publishedPreviewPageIndex, setPublishedPreviewPageIndex] = createSignal(0);
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
  const [bookEmulatorIndex, setBookEmulatorIndex] = createSignal(0);
  const [bookEmulatorFlipDirection, setBookEmulatorFlipDirection] = createSignal<
    "forward" | "backward"
  >("forward");
  const [isExportingPdf, setIsExportingPdf] = createSignal(false);
  const [isExportingPrintPackage, setIsExportingPrintPackage] = createSignal(false);
  const [exportPdfError, setExportPdfError] = createSignal<string | null>(null);
  const [exportPackageError, setExportPackageError] = createSignal<string | null>(null);
  const [backCoverQrDataUrl, setBackCoverQrDataUrl] = createSignal<string | null>(null);
  const [isBookEmulatorFullscreen, setIsBookEmulatorFullscreen] = createSignal(false);
  const [explicitContentConfirmOpen, setExplicitContentConfirmOpen] = createSignal(false);

  let autosaveTimer: number | undefined;
  let lastSavedSnapshot = "";
  let pendingSnapshot = "";
  let lastFetchedImagesStoryId: string | null = null;
  let routeInitialized = false;
  let isApplyingRoute = false;
  let lastRouteUrl = "";
  let bookEmulatorStageEl: HTMLDivElement | null = null;

  applyColorMode(initialColorMode);

  const clearStoredAuth = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(authSessionStorageKey);
    window.localStorage.removeItem(legacyUserStorageKey);
  };

  const resetSignedInWorkspace = () => {
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
    setStoryDeskArchives([]);
    setStoryDeskPage(0);
    setStoryDeskHasMore(true);
    setStoryDeskError(null);
    setPublishedStoryArchives([]);
    setPublishedStoryPage(0);
    setPublishedStoryHasMore(true);
    setPublishedStoryError(null);
    setPublishedPreviewPageIndex(0);
    setHomeShelfTab("private");
    setStoryDeskFilter("all");
    setStoryDeskQuery("");
    setSelectedStoryId(null);
    resetStudioState({ preserveSelection: true, preserveTab: false });
  };

  const applyAuthenticatedSession = (session: AuthSessionSnapshot) => {
    const normalizedSession = normalizeAuthSession(session);
    setAuthSession(normalizedSession);
    setAuthUser(normalizedSession.username);
    setAuthReady(true);
    setAuthUsername(normalizedSession.username);
    setAuthPassword("");
    setAuthError(null);
  };

  const expireAuthenticatedSession = (message?: string) => {
    setAuthUsername((current) => {
      const preserved = normalizeWhitespace(current);
      if (preserved.length > 0) return current;
      return authUser() ?? "";
    });
    setAuthSession(null);
    setAuthUser(null);
    setAuthPassword("");
    setAuthMode("login");
    resetSignedInWorkspace();
    clearStoredAuth();
    setAuthError(message ?? null);
  };

  const buildApiHeaders = (
    init?: RequestInit,
    options?: { includeJsonContentType?: boolean },
  ) => {
    const headers = new Headers(init?.headers);
    if (
      options?.includeJsonContentType !== false &&
      init?.body &&
      !headers.has("Content-Type") &&
      !(init.body instanceof FormData)
    ) {
      headers.set("Content-Type", "application/json");
    }
    return headers;
  };

  const authorizedFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
    options?: { includeJsonContentType?: boolean },
  ) => {
    const response = await fetch(input, {
      ...init,
      credentials: init?.credentials ?? "include",
      headers: buildApiHeaders(init, options),
    });
    if (response.status === 401 && authSession()) {
      expireAuthenticatedSession("Your session expired. Please sign in again.");
    }
    return response;
  };

  const fetchCurrentAuthenticatedSession = async (): Promise<AuthSessionSnapshot | null> => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/session`, {
        method: "GET",
        credentials: "include",
      });
      const data = (await response.json().catch(() => null)) as AuthSessionStatusResponse | null;
      if (!response.ok || !data?.valid) {
        return null;
      }
      const expiresAt = typeof data.session?.expires_at === "number"
        ? data.session.expires_at * 1000
        : 0;
      if (!data.user?.username || !data.user?.id || !expiresAt) {
        return null;
      }
      return normalizeAuthSession({
        token: cookieSessionMarker,
        username: data.user.username,
        userId: data.user.id,
        expiresAt,
      });
    } catch {
      return null;
    }
  };

  const waitForAuthenticatedSession = async (
    attempts = 5,
    delayMs = 150,
  ): Promise<AuthSessionSnapshot | null> => {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const session = await fetchCurrentAuthenticatedSession();
      if (session) return session;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, delayMs));
      }
    }
    return null;
  };

  onMount(() => {
    if (typeof window === "undefined") return;
    clearStoredAuth();
    void (async () => {
      const cookieSession = await fetchCurrentAuthenticatedSession();
      if (cookieSession) {
        applyAuthenticatedSession(cookieSession);
        void fetchStoryDeskPageWithSession(
          0,
          "replace",
          cookieSession.username,
        );
        return;
      }
      if (authSession() || authUser()) {
        expireAuthenticatedSession();
      } else {
        clearStoredAuth();
      }
      setAuthReady(true);
    })();
  });

  createEffect(() => {
    const session = authSession();
    if (!session) return;
    const remainingMs = session.expiresAt - Date.now();
    if (remainingMs <= 0) {
      expireAuthenticatedSession("Your session expired. Please sign in again.");
      return;
    }
    if (typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      expireAuthenticatedSession("Your session expired. Please sign in again.");
    }, remainingMs);
    onCleanup(() => window.clearTimeout(timeoutId));
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
    buildImageSteps(builder(), imagePlan(), imageSettings(), finalStory()),
  );
  const getEffectiveImagePrompt = (step: ImageStep | null) => {
    if (!step) return "";
    return imageSettings().promptOverrides[step.id] ?? step.prompt;
  };
  const activeImageStep = createMemo(() => {
    const steps = imageSteps();
    if (steps.length === 0) return null;
    return steps[Math.min(activeImageStepIndex(), steps.length - 1)]!;
  });
  const activeImageGeometry = createMemo(() =>
    getStepGeometry(imageSettings(), activeImageStep()),
  );
  const activeImagePrompt = createMemo(() => getEffectiveImagePrompt(activeImageStep()));
  const activeImageResult = createMemo(() => {
    const step = activeImageStep();
    if (!step) return null;
    return imageStepResults()[step.id] ?? { status: "idle" as const };
  });
  const activeImageUrl = createMemo(() => {
    const result = activeImageResult();
    return result?.storedUrl ?? result?.imageUrl ?? null;
  });
  const activeLayoutStep = createMemo(() => {
    const story = finalStory();
    if (!story?.pages?.length) return null;
    return imageSteps().find((step) => step.id === `page-${finalPageIndex() + 1}`) ?? null;
  });
  const activeLayoutResult = createMemo(() => {
    const step = activeLayoutStep();
    if (!step) return null;
    return imageStepResults()[step.id] ?? { status: "idle" as const };
  });
  const activeLayoutImageUrl = createMemo(() => {
    const result = activeLayoutResult();
    return result?.storedUrl ?? result?.imageUrl ?? null;
  });
  const activeLayoutSettings = createMemo<BookLayoutSettings>(() => {
    const pageKey = `page-${finalPageIndex() + 1}`;
    return getBookLayoutSettingsForPageId(imageSettings(), pageKey);
  });
  const activeLayoutGeometry = createMemo(() => getBookLayoutGeometry(imageSettings()));
  const activeLayoutTextWidth = createMemo(() =>
    getBookLayoutTextWidth(activeLayoutSettings().bookLayoutTextWidth),
  );
  const activeLayoutTextSurface = createMemo(() =>
    getBookLayoutTextSurface(activeLayoutSettings().bookLayoutTextSurface),
  );
  const activeLayoutPositionOptions = createMemo(() =>
    getBookLayoutTextPositionOptions(activeLayoutSettings().bookLayoutTextWidth),
  );
  const activeLayoutPositionNote = createMemo(() =>
    activeLayoutSettings().bookLayoutTextWidth === "full"
      ? "Choose whether the full-width text band sits at the top, middle, or bottom of the spread."
      : "Pin the compact text card to one of nine safe-area positions so it avoids the important art.",
  );
  const activeLayoutFont = createMemo(() =>
    getBookLayoutFont(activeLayoutSettings().bookLayoutFont),
  );
  const activeLayoutFontWeight = createMemo(() =>
    getBookLayoutFontWeight(activeLayoutSettings().bookLayoutFontWeight),
  );
  const activeLayoutPageText = createMemo(
    () => finalStory()?.pages[finalPageIndex()] ?? "",
  );
  const activeLayoutStatusMeta = createMemo(() => {
    const result = activeLayoutResult();
    if (result?.status === "saved") {
      return {
        tone: "saved",
        label: "Saved page art",
        note: "Using the accepted image from your story library as the preview background.",
      } as const;
    }
    if (result?.status === "generated") {
      return {
        tone: "generated",
        label: "Generated preview art",
        note: "Previewing the latest generated image. Save it in Images once you approve it.",
      } as const;
    }
    return {
      tone: "idle",
      label: "No page art yet",
      note: "Accept a page image in Images to see the full storybook spread here.",
    } as const;
  });
  const resolvedBackCoverSlogan = createMemo(() => {
    const custom = normalizeWhitespace(imageSettings().backCoverSlogan);
    return custom.length > 0 ? custom : backCoverSlogan;
  });
  const resolvedBackCoverTagline = createMemo(() =>
    normalizeWhitespace(imageSettings().backCoverTagline),
  );
  const resolvedBackCoverBlurb = createMemo(() =>
    normalizeWhitespace(imageSettings().backCoverBlurb),
  );
  const resolvedBackCoverAgeBand = createMemo(() => {
    const custom = normalizeWhitespace(imageSettings().backCoverAgeBand);
    return custom.length > 0 ? custom : builder().ageBand || backCoverAgeBand;
  });
  const resolvedBackCoverQrUrl = createMemo(() => {
    const custom = normalizeWhitespace(imageSettings().backCoverQrUrl);
    if (custom.length > 0) return custom;
    if (typeof window === "undefined") return "";
    const storyId = activeStoryId();
    if (!storyId) return "";
    return `${window.location.origin}${buildRouteUrl({
      view: "studio",
      tab: "layout",
      story: storyId,
    })}`;
  });
  const resolvedBackCoverBarcodeText = createMemo(() =>
    normalizeWhitespace(imageSettings().backCoverBarcodeText),
  );
  createEffect(() => {
    const url = resolvedBackCoverQrUrl();
    const shouldPrimeQr =
      activeTab() === "layout" ||
      (activeTab() === "images" && activeImageStep()?.kind === "back_cover");
    if (!imageSettings().backCoverShowQr || url.length === 0 || !shouldPrimeQr) {
      setBackCoverQrDataUrl(null);
      return;
    }

    let cancelled = false;
    void loadQrCode()
      .then((QRCode) =>
        QRCode.toDataURL(url, {
          margin: 1,
          width: 280,
          color: {
            dark: "#392958",
            light: "#0000",
          },
        }),
      )
      .then((dataUrl) => {
        if (!cancelled) {
          setBackCoverQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBackCoverQrDataUrl(null);
        }
      });

    onCleanup(() => {
      cancelled = true;
    });
  });
  const ensureBackCoverQrDataUrl = async () => {
    const existing = backCoverQrDataUrl();
    if (existing) return existing;
    const url = resolvedBackCoverQrUrl();
    if (!imageSettings().backCoverShowQr || url.length === 0) return null;
    try {
      const QRCode = await loadQrCode();
      const dataUrl = await QRCode.toDataURL(url, {
        margin: 1,
        width: 280,
        color: {
          dark: "#392958",
          light: "#0000",
        },
      });
      setBackCoverQrDataUrl(dataUrl);
      return dataUrl;
    } catch {
      return null;
    }
  };
  const createImageVersionEntry = (
    step: ImageStep,
    prompt: string,
    result: Pick<ImageStepResult, "imageUrl" | "storedUrl">,
    status: "generated" | "saved",
  ): ImageVersionEntry => ({
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${step.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    status,
    prompt,
    imageUrl: normalizeClientImageUrl(result.imageUrl),
    storedUrl: normalizeClientImageUrl(result.storedUrl),
    createdAt: new Date().toISOString(),
  });
  const pushImageHistoryEntry = (
    stepId: string,
    entry: ImageVersionEntry,
  ) => {
    setImageSettings((current) => ({
      ...current,
      imageHistory: {
        ...current.imageHistory,
        [stepId]: [entry, ...(current.imageHistory[stepId] ?? [])].slice(0, 14),
      },
    }));
  };
  const setImageStepLock = (stepId: string, locked: boolean) => {
    setImageSettings((current) => ({
      ...current,
      lockedSteps: {
        ...current.lockedSteps,
        [stepId]: locked,
      },
    }));
    setHasTouched(true);
    setReadyOverride(null);
  };
  const setImageStepQaReviewed = (stepId: string, reviewed: boolean) => {
    setImageSettings((current) => ({
      ...current,
      qaReviewedSteps: {
        ...current.qaReviewedSteps,
        [stepId]: reviewed,
      },
    }));
    setHasTouched(true);
    setReadyOverride(null);
  };
  const updateImageQaReviewNote = (stepId: string, value: string) => {
    setImageSettings((current) => ({
      ...current,
      qaReviewNotes: {
        ...current.qaReviewNotes,
        [stepId]: value,
      },
    }));
    setHasTouched(true);
    setReadyOverride(null);
  };
  const setImageStepQaStatus = (
    stepId: string,
    patch: Partial<Pick<ImageStepResult, "qaState" | "qaReport" | "qaError">>,
  ) => {
    setImageStepResults((current) => {
      const existing = current[stepId];
      if (!existing) return current;
      return {
        ...current,
        [stepId]: {
          ...existing,
          ...patch,
        },
      };
    });
  };
  const runAutomatedImageQa = async (
    step: ImageStep,
    imageRef: string,
    prompt: string,
    geometry: StepGeometry,
  ) => {
    setImageStepQaStatus(step.id, {
      qaState: "running",
      qaError: undefined,
    });

    try {
      const storyText =
        step.kind === "page" ? finalStory()?.pages[step.pageIndex ?? 0] ?? "" : "";
      const builderState = builder();
      const cast = buildCastFromState(builderState);
      const additionalCharacters = builderState.additionalCharacters ?? [];
      const sameCastRisk =
        cast.castList.length >= 2 &&
        [builderState.protagonistGender, ...additionalCharacters.map((character) => character.gender)]
          .map((value) => normalizeWhitespace(value).toLowerCase())
          .filter((value) => value.length > 0).length >= 2;

      const qaImageRef = imageRef.startsWith("data:")
        ? imageRef
        : await fetchImageAsDataUrl(imageRef);

      const [metrics, response] = await Promise.all([
        readImageMetrics(imageRef),
        authorizedFetch(`${apiBaseUrl}/api/images/qa`, {
          method: "POST",
          body: JSON.stringify({
            image: qaImageRef,
            prompt,
            story_text: storyText,
            step_kind: step.kind,
            step_label: step.label,
            expected_aspect_ratio: geometry.aspectRatioLabel,
            expected_trim_label: geometry.trimLabel,
            same_cast_risk: sameCastRisk,
          }),
        }),
      ]);

      const payload = (await response.json().catch(() => null)) as ImageQaResponse | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Automated image QA could not finish.");
      }

      const normalized = normalizeImageQaResponse(payload);
      const checkedAt = new Date().toISOString();
      setImageStepQaStatus(step.id, {
        qaState: "complete",
        qaError: undefined,
        qaReport: {
          summary: normalized.summary,
          checkedAt,
          issues: normalized.issues,
          imageWidth: metrics.width,
          imageHeight: metrics.height,
          expectedAspectRatio: geometry.aspectRatioLabel,
          expectedPixelWidth: geometry.pixelWidth,
          expectedPixelHeight: geometry.pixelHeight,
        },
      });
      setImageStepQaReviewed(step.id, false);
    } catch (error) {
      setImageStepQaStatus(step.id, {
        qaState: "error",
        qaError:
          error instanceof Error ? error.message : "Automated QA is unavailable right now.",
      });
    }
  };
  const activeImageHistory = createMemo(() => {
    const step = activeImageStep();
    if (!step) return [] as ImageVersionEntry[];
    return imageSettings().imageHistory[step.id] ?? [];
  });
  const activeImageLocked = createMemo(() => {
    const step = activeImageStep();
    if (!step) return false;
    return Boolean(imageSettings().lockedSteps[step.id]);
  });
  const activeImageQaReviewed = createMemo(() => {
    const step = activeImageStep();
    if (!step) return false;
    return Boolean(imageSettings().qaReviewedSteps[step.id]);
  });
  const activeImageQaReviewNote = createMemo(() => {
    const step = activeImageStep();
    if (!step) return "";
    return imageSettings().qaReviewNotes[step.id] ?? "";
  });
  const activeImageQaWarnings = createMemo<StepQaWarning[]>(() => {
    const step = activeImageStep();
    if (!step) return [];
    const storyText =
      step.kind === "page" ? finalStory()?.pages[step.pageIndex ?? 0] ?? "" : "";
    const result = imageStepResults()[step.id] ?? { status: "idle" as const };
    const builderState = builder();
    const cast = buildCastFromState(builderState);
    const additionalCharacters = builderState.additionalCharacters ?? [];
    const geometry = getStepGeometry(imageSettings(), step);
    const sameCastRisk =
      cast.castList.length >= 2 &&
      [builderState.protagonistGender, ...additionalCharacters.map((character) => character.gender)]
        .map((value) => normalizeWhitespace(value).toLowerCase())
        .filter((value) => value.length > 0).length >= 2;
    return buildStepQaWarnings({
      step: {
        id: step.id,
        label: step.label,
        kind: step.kind,
      },
      prompt: activeImagePrompt(),
      storyText,
      status: result.status,
      sameCastRisk,
      expectedAspectRatioLabel: geometry.aspectRatioLabel,
      expectedPixelWidth: geometry.pixelWidth,
      expectedPixelHeight: geometry.pixelHeight,
      actualPixelWidth: result.qaReport?.imageWidth,
      actualPixelHeight: result.qaReport?.imageHeight,
      automatedIssues: result.qaReport?.issues ?? [],
      qaFailed: result.qaState === "error",
    });
  });
  const activeImageQaReport = createMemo(() => activeImageResult()?.qaReport ?? null);
  const activeImageQaStatus = createMemo(() => activeImageResult()?.qaState ?? "idle");
  const activeImageQaBlockerCount = createMemo(
    () =>
      activeImageQaReport()?.issues.filter((issue) => issue.severity === "blocker").length ??
      0,
  );
  const activeImageNeedsQaBlockerReview = createMemo(
    () => activeImageQaBlockerCount() > 0 && !activeImageQaReviewed(),
  );
  const canAcceptActiveImage = createMemo(
    () =>
      !isAcceptingImage() &&
      activeImageQaStatus() !== "running" &&
      !activeImageNeedsQaBlockerReview(),
  );
  const unresolvedQaStepIds = createMemo(() =>
    imageSteps()
      .filter((step) => {
        const result = imageStepResults()[step.id];
        if (result?.status !== "saved") return false;
        return !imageSettings().qaReviewedSteps[step.id];
      })
      .map((step) => step.id),
  );
  const unresolvedQaBlockerStepIds = createMemo(() =>
    imageSteps()
      .filter((step) => {
        const result = imageStepResults()[step.id];
        if (result?.status !== "saved") return false;
        if (imageSettings().qaReviewedSteps[step.id]) return false;
        return Boolean(result.qaReport?.issues.some((issue) => issue.severity === "blocker"));
      })
      .map((step) => step.id),
  );
  const publishValidation = createMemo(() => {
    const story = finalStory();
    const steps = imageSteps();
    const results = imageStepResults();
    const savedStepCount = steps.filter((step) => results[step.id]?.status === "saved").length;
    const lockedSavedCount = steps.filter(
      (step) => results[step.id]?.status === "saved" && imageSettings().lockedSteps[step.id],
    ).length;
    const pageTextCompleteness = story
      ? story.pages.filter((page) => normalizeWhitespace(page).length > 0).length
      : 0;
    return buildPublishValidation({
      title: story?.title ?? storyPlan().title,
      pageCount: story?.pages.length ?? 0,
      expectedPageCount: builder().spreads,
      savedStepCount,
      totalStepCount: steps.length,
      pageTextCompleteness,
      hasBackCoverQrUrl: resolvedBackCoverQrUrl().length > 0,
      showBackCoverQr: imageSettings().backCoverShowQr,
      showBackCoverLogo: imageSettings().backCoverShowLogo,
      showBackCoverSlogan: imageSettings().backCoverShowSlogan,
      backCoverSlogan: resolvedBackCoverSlogan(),
      printBleedInches: imageSettings().printBleedInches,
      unresolvedQaCount: unresolvedQaStepIds().length,
      unresolvedQaBlockerCount: unresolvedQaBlockerStepIds().length,
      lockedSavedCount,
      hasFinalStory: Boolean(story),
    });
  });
  createEffect(() => {
    const step = activeImageStep();
    const result = activeImageResult();
    const prompt = activeImagePrompt().trim();
    const geometry = activeImageGeometry();
    if (
      activeTab() !== "images" ||
      !authReady() ||
      !authSession() ||
      !authUser() ||
      !step ||
      !prompt ||
      !result ||
      (result.status !== "generated" && result.status !== "saved") ||
      result.qaState === "running" ||
      Boolean(result.qaReport) ||
      Boolean(result.qaError)
    ) {
      return;
    }

    const imageRef = result.imageUrl ?? result.storedUrl;
    if (!imageRef) return;
    void runAutomatedImageQa(step, imageRef, prompt, geometry);
  });
  const bookEmulatorSheets = createMemo<BookEmulatorSheet[]>(() => {
    if (activeTab() !== "layout" && !isExportingPdf() && !isExportingPrintPackage()) {
      return [];
    }
    const story = finalStory();
    if (!story) return [];
    const settings = imageSettings();
    const results = imageStepResults();
    return imageSteps().map((step) => {
      const result = results[step.id] ?? { status: "idle" as const };
      const imageUrl = result.storedUrl ?? result.imageUrl;
      const isPage = step.kind === "page";
      return {
        id: step.id,
        label: step.label,
        subtitle:
          step.kind === "cover"
            ? "Front cover"
            : step.kind === "back_cover"
              ? "Back cover"
              : `Page ${(step.pageIndex ?? 0) + 1}`,
        kind: step.kind,
        imageUrl,
        geometry: getStepGeometry(settings, step),
        status: result.status,
        text: isPage ? story.pages[step.pageIndex ?? 0] ?? "" : "",
        layout: isPage
          ? getBookLayoutSettingsForPageId(settings, step.id)
          : getBookLayoutDefaultsFromImageSettings(settings),
      };
    });
  });
  const bookEmulatorActiveSheet = createMemo(() => {
    const sheets = bookEmulatorSheets();
    if (sheets.length === 0) return null;
    const index = Math.min(Math.max(bookEmulatorIndex(), 0), sheets.length - 1);
    return sheets[index] ?? null;
  });
  const bookEmulatorStatusMeta = createMemo(() => {
    const sheet = bookEmulatorActiveSheet();
    if (!sheet) {
      return {
        source: "Waiting on book",
        note: "Generate and save the cover and pages in Images so the emulator can assemble the book.",
      };
    }
    if (sheet.status === "saved") {
      return {
        source: "Accepted art",
        note: "Showing the saved image from your story library inside the emulator.",
      };
    }
    if (sheet.status === "generated") {
      return {
        source: "Generated art",
        note: "Showing the latest generated image. Save it in Images when you want this version locked in.",
      };
    }
    return {
      source: "Waiting on art",
      note:
        sheet.kind === "page"
          ? "This page is still waiting for art. Generate it in Images and it will drop into the emulator."
          : "Generate this cover in Images and it will appear in the emulator.",
    };
  });
  createEffect(() => {
    const sheets = bookEmulatorSheets();
    if (sheets.length === 0) {
      setBookEmulatorIndex(0);
      return;
    }
    setBookEmulatorIndex((current) => Math.min(Math.max(current, 0), sheets.length - 1));
  });
  const goBookEmulatorPrev = () => {
    setBookEmulatorFlipDirection("backward");
    setBookEmulatorIndex((current) => Math.max(0, current - 1));
  };
  const goBookEmulatorNext = () => {
    const sheets = bookEmulatorSheets();
    setBookEmulatorFlipDirection("forward");
    setBookEmulatorIndex((current) => Math.min(sheets.length - 1, current + 1));
  };
  createEffect(() => {
    if (typeof document === "undefined") return;
    const handleFullscreenChange = () => {
      setIsBookEmulatorFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    onCleanup(() => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    });
  });
  const coverReferenceImage = createMemo(() => {
    const coverResult = imageStepResults().cover;
    return coverResult?.imageUrl ?? coverResult?.storedUrl ?? null;
  });
  const backCoverReferenceImage = createMemo(() => {
    const backCoverResult = imageStepResults()["back-cover"];
    return backCoverResult?.imageUrl ?? backCoverResult?.storedUrl ?? null;
  });
  const getStepReferenceImages = (step: ImageStep | null) => {
    if (!step) return [] as ReferenceImageSource[];
    const references: ReferenceImageSource[] = [];
    const coverImage = coverReferenceImage();
    if (coverImage && (step.kind === "page" || step.kind === "back_cover")) {
      references.push({ src: coverImage, kind: "cover" });
    }

    if (step.kind === "page" && (step.pageIndex ?? 0) > 0) {
      const previousPageId = `page-${step.pageIndex ?? 0}`;
      const previousPageResult = imageStepResults()[previousPageId];
      const previousPageImage = previousPageResult?.storedUrl ?? previousPageResult?.imageUrl;
      if (
        previousPageImage &&
        !references.some((reference) => reference.src === previousPageImage)
      ) {
        references.push({ src: previousPageImage, kind: "page" });
      }
    }

    if (step.kind === "page") {
      const backCoverImage = backCoverReferenceImage();
      if (
        backCoverImage &&
        !references.some((reference) => reference.src === backCoverImage)
      ) {
        references.push({ src: backCoverImage, kind: "cover" });
      }
    }

    return references;
  };
  const isImageStepUnlocked = (index: number) => {
    if (index <= 0) return true;
    const steps = imageSteps();
    const results = imageStepResults();
    const previous = steps[index - 1];
    if (!previous) return false;
    const previousResult = results[previous.id];
    return previousResult?.status === "saved";
  };
  const readyForPublish = createMemo(() => {
    const override = readyOverride();
    if (override !== null) return override;
    return publishValidation().ready;
  });
  const imageProgress = createMemo(() => {
    const steps = imageSteps();
    const results = imageStepResults();
    const coverSteps = steps.filter(
      (step) => step.kind === "cover" || step.kind === "back_cover",
    );
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
    const spreadLayout = getSpreadLayoutLabel(settings.spreadLayout);

    return steps.flatMap((step) => {
      const result = results[step.id];
      const imageUrl = result?.storedUrl ?? result?.imageUrl;
      if (!imageUrl) return [];
      const geometry = getStepGeometry(settings, step);
      const kindLabel =
        step.kind === "cover"
          ? "Front cover"
          : step.kind === "back_cover"
            ? "Back cover"
            : `Page ${(step.pageIndex ?? 0) + 1}`;
      const sourceLabel = result?.storedUrl ? "Saved to library" : "Generated";
      return [
        {
          id: step.id,
          title: step.label,
          subtitle: kindLabel,
          imageUrl,
          source: "generated",
          prompt: getEffectiveImagePrompt(step),
          meta: [
            { label: "Type", value: kindLabel },
            { label: "Status", value: result?.status ?? "Generated" },
            { label: "Book size", value: geometry.trimLabel },
            { label: "Spread layout", value: spreadLayout },
            { label: "Aspect ratio", value: geometry.aspectRatioLabel },
            { label: "Output size", value: geometry.pixelSizeLabel },
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
  const showBackCoverPreviewImprint = createMemo(
    () => activeImageStep()?.kind === "back_cover" && Boolean(activeImageUrl()),
  );
  const isBackCoverModalItem = (item: ImageModalItem) => item.subtitle === "Back cover";
  const updateImagePromptOverride = (stepId: string, value: string) => {
    setImageSettings((current) => ({
      ...current,
      promptOverrides: {
        ...current.promptOverrides,
        [stepId]: value,
      },
    }));
    setHasTouched(true);
  };
  const resetImagePromptOverride = (stepId: string, fallbackPrompt: string) => {
    setImageSettings((current) => {
      const nextOverrides = { ...current.promptOverrides };
      delete nextOverrides[stepId];
      return {
        ...current,
        promptOverrides: nextOverrides,
      };
    });
    setHasTouched(true);
    setImageError(null);
    if (fallbackPrompt.trim().length > 0) {
      setHasGeneratedImages(Boolean(activeImageResult()?.status));
    }
  };

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
  const publishedLibraryEntries = createMemo<StoryDeskEntry[]>(() => publishedStoryArchives());
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
  const activeHomeEntries = createMemo<StoryDeskEntry[]>(() =>
    homeShelfTab() === "published" ? publishedLibraryEntries() : storyDeskEntries(),
  );
  const activeHomeCounts = createMemo(() =>
    homeShelfTab() === "published"
      ? {
          draft: 0,
          review: 0,
          ready: 0,
          published: publishedLibraryEntries().length,
        }
      : storyDeskCounts(),
  );
  const activeHomeError = createMemo(() =>
    homeShelfTab() === "published" ? publishedStoryError() : storyDeskError(),
  );
  const activeHomeLoading = createMemo(() =>
    homeShelfTab() === "published" ? publishedStoryLoading() : storyDeskLoading(),
  );
  const activeHomeHasMore = createMemo(() =>
    homeShelfTab() === "published" ? publishedStoryHasMore() : storyDeskHasMore(),
  );
  const filteredStoryDeskEntries = createMemo(() => {
    const query = storyDeskQuery().trim().toLowerCase();
    const filter = storyDeskFilter();
    const isPublishedShelf = homeShelfTab() === "published";
    let entries = activeHomeEntries();
    if (!isPublishedShelf && filter !== "all") {
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
      if (item.ownerUsername.toLowerCase().includes(query)) return true;
      if (item.summary.toLowerCase().includes(query)) return true;
      return item.tags.some((tag) => tag.toLowerCase().includes(query));
    });
  });
  const activeStory = createMemo<StoryDeskEntry | null>(() => {
    const entries = filteredStoryDeskEntries();
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
      ownerUsername: authUser() ?? "",
      visibility: "private",
      viewerOwnsEntry: true,
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
  const activePublishedStoryPageCount = createMemo(
    () => activeStory()?.finalStorySnapshot?.pages.length ?? 0,
  );
  const activePublishedPreviewImage = createMemo(() => {
    if (homeShelfTab() !== "published") return null;
    const story = activeStory();
    if (!story) return null;
    const pageId = `page-${publishedPreviewPageIndex() + 1}`;
    const pageResult = story.imageResultsSnapshot?.[pageId];
    return pageResult?.storedUrl ?? pageResult?.imageUrl ?? null;
  });
  const activePublishedPreviewText = createMemo(() => {
    if (homeShelfTab() !== "published") return "";
    const pages = activeStory()?.finalStorySnapshot?.pages ?? [];
    return pages[publishedPreviewPageIndex()] ?? "";
  });

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
    if (entry.visibility === "public" && !entry.viewerOwnsEntry) {
      setHomeShelfTab("published");
      setSelectedStoryId(entry.id);
      setPublishedPreviewPageIndex(0);
      return;
    }
    if (hasTouched()) {
      setPendingStory(entry);
      setPendingWorkspace(null);
      setUnsavedConfirmOpen(true);
      return;
    }
    openStoryDeskEntry(entry);
  };

  const selectStoryDeskEntry = (entry: StoryDeskEntry) => {
    setSelectedStoryId(entry.id);
    if (entry.visibility === "public") {
      setPublishedPreviewPageIndex(0);
    }
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

  const fetchStoryDeskPageWithSession = async (
    page: number,
    mode: "append" | "replace",
    username: string,
  ) => {
    if (!authReady()) return;
    if (!username || !authSession()) return;
    if (storyDeskLoading()) return;
    setStoryDeskLoading(true);
    setStoryDeskError(null);

    try {
      const response = await authorizedFetch(`${apiBaseUrl}/api/stories/list`, {
        method: "POST",
        body: JSON.stringify({
          username,
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
        ? data.stories.map((story) =>
            buildStoryDeskEntryFromRecord(story, {
              visibility: "private",
              viewerUsername: username,
            }),
          )
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

  const fetchStoryDeskPage = async (page: number, mode: "append" | "replace") => {
    if (!authReady()) return;
    const user = authUser();
    if (!user || !authSession()) return;
    await fetchStoryDeskPageWithSession(page, mode, user);
  };

  const fetchPublishedStoriesPage = async (page: number, mode: "append" | "replace") => {
    if (!authReady()) return;
    if (publishedStoryLoading()) return;
    setPublishedStoryLoading(true);
    setPublishedStoryError(null);

    try {
      const response = await authorizedFetch(`${apiBaseUrl}/api/stories/published/list`, {
        method: "POST",
        body: JSON.stringify({
          page,
          page_size: storyDeskPageSize,
        }),
      });

      const data = (await response.json().catch(() => null)) as StoryListResponse | null;
      if (!response.ok) {
        setPublishedStoryError(
          (data as { error?: string } | null)?.error ?? "Unable to load published stories.",
        );
        setPublishedStoryHasMore(false);
        return;
      }

      const viewerUsername = authUser();
      const entries = Array.isArray(data?.stories)
        ? data.stories.map((story) =>
            buildStoryDeskEntryFromRecord(story, {
              visibility: "public",
              viewerUsername,
            }),
          )
        : [];
      setPublishedStoryArchives((items) =>
        mode === "append" ? [...items, ...entries] : entries,
      );
      setPublishedStoryPage(page);
      setPublishedStoryHasMore(Boolean(data?.has_more));
    } catch (err) {
      setPublishedStoryError("Network error. Please try again.");
    } finally {
      setPublishedStoryLoading(false);
    }
  };

  const fetchStoryImages = async (storyId: string) => {
    if (!authReady() || !storyId || !authUser() || !authSession()) return;
    try {
      const response = await authorizedFetch(`${apiBaseUrl}/api/images/list`, {
        method: "POST",
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
      const savedResults = mapSavedImagesToResults(images, imageStepResults());
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
    if (
      !authReady() ||
      !storyId ||
      activeTab() !== "images" ||
      !authUser() ||
      !authSession()
    ) {
      return;
    }
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
      const response = await authorizedFetch(`${apiBaseUrl}/api/stories/delete`, {
        method: "POST",
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
    if (!authReady()) {
      return;
    }
    const user = authUser();
    if (user && authSession()) {
      return;
    }
    setStoryDeskArchives([]);
    setStoryDeskPage(0);
    setStoryDeskHasMore(true);
    setStoryDeskError(null);
    setPublishedStoryArchives([]);
    setPublishedStoryPage(0);
    setPublishedStoryHasMore(true);
    setPublishedStoryError(null);
    setSelectedStoryId(null);
  });

  createEffect(() => {
    const entries = activeHomeEntries();
    const selected = selectedStoryId();
    if (entries.length === 0) {
      if (selected !== null && !routeStoryId()) {
        setSelectedStoryId(null);
      }
      return;
    }
    if (routeStoryId() && homeShelfTab() === "private") {
      return;
    }
    if (!selected || !entries.some((item) => item.id === selected)) {
      setSelectedStoryId(entries[0]!.id);
    }
  });

  createEffect(() => {
    if (!authReady() || !authUser() || !authSession()) return;
    if (activeWorkspace() !== "home") return;
    if (homeShelfTab() !== "published") return;
    if (publishedStoryArchives().length > 0 || publishedStoryLoading()) return;
    void fetchPublishedStoriesPage(0, "replace");
  });

  createEffect(() => {
    const pageCount = activePublishedStoryPageCount();
    if (pageCount <= 0) {
      setPublishedPreviewPageIndex(0);
      return;
    }
    setPublishedPreviewPageIndex((current) => Math.min(Math.max(current, 0), pageCount - 1));
  });

  createEffect(() => {
    if (homeShelfTab() !== "published") return;
    activeStory()?.id;
    setPublishedPreviewPageIndex(0);
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

  const renderBackCoverImprint = (variant: "preview" | "modal" | "emulator") => (
    <div class={`back-cover-imprint ${variant}`}>
      <Show when={imageSettings().backCoverShowLogo}>
        <div class="back-cover-logo-lockup">
          <img class="back-cover-logo" src={logoUrl} alt="Mary Ann Stories logo" />
        </div>
      </Show>
      <Show when={imageSettings().backCoverShowSlogan && resolvedBackCoverSlogan().length > 0}>
        <p class="back-cover-slogan">{resolvedBackCoverSlogan()}</p>
      </Show>
      <Show when={imageSettings().backCoverShowTagline && resolvedBackCoverTagline().length > 0}>
        <p class="back-cover-tagline">{resolvedBackCoverTagline()}</p>
      </Show>
      <Show when={imageSettings().backCoverShowAgeBand && resolvedBackCoverAgeBand().length > 0}>
        <p class="back-cover-age-band">{resolvedBackCoverAgeBand()}</p>
      </Show>
      <Show when={imageSettings().backCoverShowQr}>
        <div class="back-cover-qr" aria-label="QR code">
          <Show
            when={backCoverQrDataUrl()}
            fallback={<span class="back-cover-qr-missing">Add QR URL</span>}
          >
            <img
              class="back-cover-qr-image"
              src={backCoverQrDataUrl()!}
              alt="QR code for the story link"
            />
          </Show>
        </div>
      </Show>
      <Show
        when={
          imageSettings().backCoverShowBarcode &&
          resolvedBackCoverBarcodeText().length > 0
        }
      >
        <div class="back-cover-barcode" aria-label={resolvedBackCoverBarcodeText()}>
          <div class="back-cover-barcode-stripes" aria-hidden="true">
            <For each={Array.from({ length: 14 })}>
              {(_, index) => <span class={index() % 3 === 0 ? "wide" : ""} />}
            </For>
          </div>
          <span class="back-cover-barcode-label">{resolvedBackCoverBarcodeText()}</span>
        </div>
      </Show>
      <Show when={imageSettings().backCoverShowBlurb && resolvedBackCoverBlurb().length > 0}>
        <p class="back-cover-blurb">{resolvedBackCoverBlurb()}</p>
      </Show>
    </div>
  );

  const drawBackCoverImprintToContext = async (
    context: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
  ) => {
    const showLogo = imageSettings().backCoverShowLogo;
    const showSlogan = imageSettings().backCoverShowSlogan && resolvedBackCoverSlogan().length > 0;
    const showTagline =
      imageSettings().backCoverShowTagline && resolvedBackCoverTagline().length > 0;
    const showAgeBand =
      imageSettings().backCoverShowAgeBand && resolvedBackCoverAgeBand().length > 0;
    const showQr = imageSettings().backCoverShowQr && resolvedBackCoverQrUrl().length > 0;
    const showBarcode =
      imageSettings().backCoverShowBarcode && resolvedBackCoverBarcodeText().length > 0;
    const showBlurb =
      imageSettings().backCoverShowBlurb && resolvedBackCoverBlurb().length > 0;
    const logoImage = showLogo ? await loadImageElement(logoUrl) : null;
    const qrDataUrl = showQr ? await ensureBackCoverQrDataUrl() : null;
    const qrImage = qrDataUrl ? await loadImageElement(qrDataUrl) : null;
    const imprintWidth = Math.min(canvasWidth * 0.34, 260);
    const logoWidth = logoImage ? imprintWidth * 0.6 : 0;
    const logoHeight =
      logoImage && logoWidth > 0
        ? (logoImage.naturalHeight / logoImage.naturalWidth) * logoWidth
        : 0;
    const x = (canvasWidth - imprintWidth) / 2;
    let y = Math.max(28, canvasHeight * 0.04);

    context.save();
    context.textAlign = "center";
    context.textBaseline = "top";

    if (logoImage && logoWidth > 0) {
      context.shadowColor = "rgba(255, 248, 236, 0.72)";
      context.shadowBlur = 22;
      context.drawImage(
        logoImage,
        x + (imprintWidth - logoWidth) / 2,
        y,
        logoWidth,
        logoHeight,
      );
      context.shadowBlur = 0;
      y += logoHeight + Math.max(10, canvasHeight * 0.008);
    }

    if (showSlogan) {
      context.font = `500 ${Math.max(14, canvasHeight * 0.018)}px ${getBookLayoutFont("friendly-sans").family}`;
      context.fillStyle = "#5a477f";
      const sloganLines = wrapCanvasText(
        context,
        resolvedBackCoverSlogan(),
        imprintWidth * 0.92,
      );
      const sloganLineHeight = Math.max(18, canvasHeight * 0.022);
      for (const line of sloganLines) {
        context.fillText(line, canvasWidth / 2, y);
        y += sloganLineHeight;
      }
    }

    if (showTagline) {
      context.font = `500 ${Math.max(12, canvasHeight * 0.015)}px ${getBookLayoutFont("friendly-sans").family}`;
      context.fillStyle = "#72538b";
      y += Math.max(4, canvasHeight * 0.004);
      context.fillText(resolvedBackCoverTagline(), canvasWidth / 2, y);
      y += Math.max(18, canvasHeight * 0.022);
    }

    if (showAgeBand) {
      context.font = `700 ${Math.max(13, canvasHeight * 0.017)}px ${getBookLayoutFont("friendly-sans").family}`;
      context.fillStyle = "#6f4c9f";
      y += Math.max(6, canvasHeight * 0.004);
      context.fillText(resolvedBackCoverAgeBand().toUpperCase(), canvasWidth / 2, y);
      y += Math.max(18, canvasHeight * 0.024);
    }

    if (qrImage) {
      const qrSize = Math.max(54, canvasHeight * 0.08);
      const qrX = (canvasWidth - qrSize) / 2;
      const qrY = y;
      context.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
      y += qrSize + Math.max(12, canvasHeight * 0.02);
    }

    if (showBlurb) {
      context.font = `500 ${Math.max(12, canvasHeight * 0.015)}px ${getBookLayoutFont("friendly-sans").family}`;
      context.fillStyle = "#4a355b";
      context.textAlign = "left";
      const blurbWidth = Math.min(imprintWidth * 1.55, canvasWidth * 0.45);
      const blurbX = (canvasWidth - blurbWidth) / 2;
      const blurbLines = wrapCanvasText(context, resolvedBackCoverBlurb(), blurbWidth);
      const blurbLineHeight = Math.max(16, canvasHeight * 0.02);
      for (const line of blurbLines) {
        context.fillText(line, blurbX, y);
        y += blurbLineHeight;
      }
      context.textAlign = "center";
      y += Math.max(10, canvasHeight * 0.012);
    }

    if (showBarcode) {
      const barcodeWidth = Math.max(78, canvasWidth * 0.12);
      const barcodeHeight = Math.max(42, canvasHeight * 0.05);
      const barcodeX = canvasWidth - Math.max(32, canvasWidth * 0.04) - barcodeWidth;
      const barcodeY = canvasHeight - Math.max(44, canvasHeight * 0.055) - barcodeHeight;
      context.save();
      context.fillStyle = "rgba(255, 252, 247, 0.86)";
      beginRoundedRectPath(context, barcodeX, barcodeY, barcodeWidth, barcodeHeight, 10);
      context.fill();
      context.fillStyle = "#2d2146";
      for (let index = 0; index < 24; index += 1) {
        const lineX = barcodeX + 10 + index * ((barcodeWidth - 20) / 24);
        const lineWidth = index % 3 === 0 ? 3 : 1.5;
        context.fillRect(lineX, barcodeY + 8, lineWidth, barcodeHeight - 20);
      }
      context.font = `600 ${Math.max(9, canvasHeight * 0.011)}px ${getBookLayoutFont("friendly-sans").family}`;
      context.fillText(
        resolvedBackCoverBarcodeText(),
        barcodeX + barcodeWidth / 2,
        barcodeY + barcodeHeight - 12,
      );
      context.restore();
    }

    context.restore();
  };

  const drawBookSheetTextToContext = (
    context: CanvasRenderingContext2D,
    sheet: BookEmulatorSheet,
    canvasWidth: number,
    canvasHeight: number,
  ) => {
    if (sheet.kind !== "page" || sheet.text.trim().length === 0) return;

    const safePad = Math.max(36, Math.round(Math.min(canvasWidth, canvasHeight) * 0.045));
    const isFullWidth = sheet.layout.bookLayoutTextWidth === "full";
    const maxCardWidth = isFullWidth
      ? canvasWidth - safePad * 2
      : Math.min(canvasWidth * 0.34, canvasWidth - safePad * 2);
    const baseFontSize =
      (isFullWidth ? canvasHeight * 0.028 : canvasHeight * 0.023) *
      sheet.layout.bookLayoutFontScale;
    const minFontSize = Math.max(18, canvasHeight * 0.016);
    const lineHeightRatio = readAloudMode() ? 1.95 : 1.68;
    const horizontalPosition = isFullWidth
      ? "full"
      : sheet.layout.bookLayoutTextPosition.endsWith("right")
        ? "right"
        : sheet.layout.bookLayoutTextPosition.endsWith("center")
          ? "center"
          : "left";
    const verticalPosition = sheet.layout.bookLayoutTextPosition.startsWith("top")
      ? "top"
      : sheet.layout.bookLayoutTextPosition.startsWith("middle")
        ? "middle"
        : "bottom";

    let fontSize = Math.max(baseFontSize, minFontSize);
    let padding = Math.max(20, canvasHeight * 0.022);
    let lines: string[] = [];
    let lineHeightPx = 0;
    let textHeight = 0;

    while (fontSize >= minFontSize) {
      context.font = `${getBookLayoutFontWeight(sheet.layout.bookLayoutFontWeight).weight} ${fontSize}px ${getBookLayoutFont(sheet.layout.bookLayoutFont).family}`;
      lineHeightPx = fontSize * lineHeightRatio;
      lines = wrapCanvasText(context, sheet.text, maxCardWidth - padding * 2);
      textHeight = 0;
      for (const line of lines) {
        textHeight += line.length === 0 ? lineHeightPx * 0.45 : lineHeightPx;
      }
      const boxHeight = textHeight + padding * 2;
      const maxAllowedHeight = isFullWidth ? canvasHeight * 0.34 : canvasHeight * 0.68;
      if (boxHeight <= maxAllowedHeight) {
        break;
      }
      fontSize -= 1;
      padding = Math.max(16, padding - 0.5);
    }

    const boxHeight = textHeight + padding * 2;
    const offsetPx = isFullWidth ? 0 : (sheet.layout.bookLayoutHorizontalOffset / 100) * canvasWidth;
    let x = safePad;
    if (!isFullWidth) {
      if (horizontalPosition === "center") {
        x = (canvasWidth - maxCardWidth) / 2;
      } else if (horizontalPosition === "right") {
        x = canvasWidth - safePad - maxCardWidth;
      }
      x = clampNumber(x + offsetPx, safePad, canvasWidth - safePad - maxCardWidth);
    }

    let y = safePad;
    if (verticalPosition === "middle") {
      y = (canvasHeight - boxHeight) / 2;
    } else if (verticalPosition === "bottom") {
      y = canvasHeight - safePad - boxHeight;
    }
    y = clampNumber(y, safePad, canvasHeight - safePad - boxHeight);

    context.save();
    if (sheet.layout.bookLayoutTextSurface === "panel") {
      beginRoundedRectPath(context, x, y, maxCardWidth, boxHeight, 22);
      context.fillStyle = "rgba(255, 250, 241, 0.965)";
      context.fill();
      context.strokeStyle = "rgba(130, 102, 62, 0.24)";
      context.lineWidth = 2;
      context.stroke();
    } else {
      context.shadowColor = "rgba(255, 247, 232, 0.86)";
      context.shadowBlur = 18;
    }

    context.font = `${getBookLayoutFontWeight(sheet.layout.bookLayoutFontWeight).weight} ${fontSize}px ${getBookLayoutFont(sheet.layout.bookLayoutFont).family}`;
    context.textBaseline = "top";
    context.textAlign = "left";
    context.fillStyle =
      sheet.layout.bookLayoutTextSurface === "panel" ? "#43311f" : "#2f2012";
    let cursorY = y + padding;
    const textX = x + padding;

    for (const line of lines) {
      if (line.length === 0) {
        cursorY += lineHeightPx * 0.45;
        continue;
      }
      context.fillText(line, textX, cursorY);
      cursorY += lineHeightPx;
    }
    context.restore();
  };

  const drawTrimMarks = (
    context: CanvasRenderingContext2D,
    trimX: number,
    trimY: number,
    trimWidth: number,
    trimHeight: number,
    bleed: number,
  ) => {
    const markLength = Math.max(16, bleed * 0.8);
    const inset = Math.max(6, bleed * 0.2);
    context.save();
    context.strokeStyle = "rgba(56, 40, 82, 0.72)";
    context.lineWidth = Math.max(1, bleed * 0.08);
    const marks = [
      [trimX - inset, trimY, trimX - inset - markLength, trimY],
      [trimX, trimY - inset, trimX, trimY - inset - markLength],
      [trimX + trimWidth + inset, trimY, trimX + trimWidth + inset + markLength, trimY],
      [trimX + trimWidth, trimY - inset, trimX + trimWidth, trimY - inset - markLength],
      [trimX - inset, trimY + trimHeight, trimX - inset - markLength, trimY + trimHeight],
      [trimX, trimY + trimHeight + inset, trimX, trimY + trimHeight + inset + markLength],
      [
        trimX + trimWidth + inset,
        trimY + trimHeight,
        trimX + trimWidth + inset + markLength,
        trimY + trimHeight,
      ],
      [
        trimX + trimWidth,
        trimY + trimHeight + inset,
        trimX + trimWidth,
        trimY + trimHeight + inset + markLength,
      ],
    ] as const;
    for (const [x1, y1, x2, y2] of marks) {
      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      context.stroke();
    }
    context.restore();
  };

  const drawSafeZoneGuides = (
    context: CanvasRenderingContext2D,
    trimX: number,
    trimY: number,
    trimWidth: number,
    trimHeight: number,
  ) => {
    const safeInset = Math.max(24, Math.round(Math.min(trimWidth, trimHeight) * 0.05));
    context.save();
    context.setLineDash([12, 10]);
    context.strokeStyle = "rgba(118, 92, 58, 0.5)";
    context.lineWidth = 2;
    context.strokeRect(
      trimX + safeInset,
      trimY + safeInset,
      trimWidth - safeInset * 2,
      trimHeight - safeInset * 2,
    );
    context.restore();
  };

  const renderBookSheetToCanvas = async (
    sheet: BookEmulatorSheet,
    options?: {
      bleedInches?: number;
      showTrimMarks?: boolean;
      showSafeZone?: boolean;
    },
  ) => {
    const bleedInches = options?.bleedInches ?? 0;
    const bleedPx = Math.round((sheet.geometry.pixelWidth / sheet.geometry.width) * bleedInches);
    const trimWidth = Math.max(1, sheet.geometry.pixelWidth);
    const trimHeight = Math.max(1, sheet.geometry.pixelHeight);
    const canvas = document.createElement("canvas");
    canvas.width = trimWidth + bleedPx * 2;
    canvas.height = trimHeight + bleedPx * 2;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to prepare PDF canvas.");
    }
    const trimX = bleedPx;
    const trimY = bleedPx;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#f7f0e5";
    context.fillRect(0, 0, canvas.width, canvas.height);

    let objectUrl: string | null = null;
    try {
      if (sheet.imageUrl) {
        objectUrl = sheet.imageUrl.startsWith("data:")
          ? null
          : await fetchImageAsObjectUrl(sheet.imageUrl);
        const image = await loadImageElement(objectUrl ?? sheet.imageUrl);
        drawImageCover(context, image, canvas.width, canvas.height);
      } else {
        const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, "#efe7da");
        gradient.addColorStop(1, "#ddd1bf");
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#5f4d3a";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = `600 ${Math.max(28, canvas.height * 0.032)}px ${getBookLayoutFont("friendly-sans").family}`;
        context.fillText(
          sheet.kind === "page" ? `${sheet.label} art pending` : `${sheet.label} pending`,
          canvas.width / 2,
          canvas.height / 2,
        );
      }

      if (sheet.kind === "page") {
        context.save();
        context.translate(trimX, trimY);
        drawBookSheetTextToContext(context, sheet, trimWidth, trimHeight);
        context.restore();
      }

      if (sheet.kind === "back_cover") {
        context.save();
        context.translate(trimX, trimY);
        await drawBackCoverImprintToContext(context, trimWidth, trimHeight);
        context.restore();
      }

      if (options?.showSafeZone) {
        drawSafeZoneGuides(context, trimX, trimY, trimWidth, trimHeight);
      }

      if (options?.showTrimMarks && bleedPx > 0) {
        drawTrimMarks(context, trimX, trimY, trimWidth, trimHeight, bleedPx);
      }

      return canvas.toDataURL("image/png");
    } finally {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    }
  };

  const handleExportPdf = async () => {
    const sheets = bookEmulatorSheets();
    if (sheets.length === 0) {
      setExportPdfError("Build the story and images first so there is something to export.");
      return;
    }
    if (!publishValidation().ready) {
      setExportPdfError(
        publishValidation().blockers[0]?.detail ??
          "Resolve the publish checklist before exporting.",
      );
      return;
    }

    setIsExportingPdf(true);
    setExportPdfError(null);

    try {
      const jsPDF = await loadJsPdf();
      let pdf: InstanceType<typeof jsPDF> | null = null;

      for (const [index, sheet] of sheets.entries()) {
        const bleed = imageSettings().printBleedInches;
        const pageWidth = (sheet.geometry.width + bleed * 2) * 72;
        const pageHeight = (sheet.geometry.height + bleed * 2) * 72;
        const orientation = pageWidth > pageHeight ? "landscape" : "portrait";
        const imageData = await renderBookSheetToCanvas(sheet, {
          bleedInches: bleed,
          showTrimMarks: imageSettings().printShowTrimMarks,
          showSafeZone: imageSettings().printShowSafeZone,
        });

        if (!pdf) {
          pdf = new jsPDF({
            orientation,
            unit: "pt",
            format: [pageWidth, pageHeight],
            compress: true,
          });
        } else {
          pdf.addPage([pageWidth, pageHeight], orientation);
        }

        pdf.addImage(imageData, "PNG", 0, 0, pageWidth, pageHeight, `sheet-${index}`, "FAST");
      }

      pdf?.save(`${slugifyFileName(finalStory()?.title ?? "mary-ann-stories-book")}.pdf`);
    } catch (error) {
      setExportPdfError(
        error instanceof Error ? error.message : "Unable to export the book as PDF.",
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportPrintPackage = async () => {
    const sheets = bookEmulatorSheets();
    if (sheets.length === 0) {
      setExportPackageError("Build the story and images first so there is something to export.");
      return;
    }
    if (!publishValidation().ready) {
      setExportPackageError(
        publishValidation().blockers[0]?.detail ??
          "Resolve the publish checklist before exporting.",
      );
      return;
    }

    setIsExportingPrintPackage(true);
    setExportPackageError(null);

    try {
      const JSZip = await loadJsZip();
      const jsPDF = await loadJsPdf();
      const zip = new JSZip();
      const manifest: Record<string, unknown> = {
        title: finalStory()?.title ?? "Mary Ann Stories book",
        exportedAt: new Date().toISOString(),
        bleedInches: imageSettings().printBleedInches,
        trimMarks: imageSettings().printShowTrimMarks,
        safeZone: imageSettings().printShowSafeZone,
        sheets: [] as Array<Record<string, unknown>>,
      };
      const pdfSheets: Array<{
        sheet: BookEmulatorSheet;
        imageData: string;
      }> = [];

      for (const [index, sheet] of sheets.entries()) {
        const imageData = await renderBookSheetToCanvas(sheet, {
          bleedInches: imageSettings().printBleedInches,
          showTrimMarks: imageSettings().printShowTrimMarks,
          showSafeZone: imageSettings().printShowSafeZone,
        });
        const blob = await (await fetch(imageData)).blob();
        const fileName = `${String(index + 1).padStart(2, "0")}-${slugifyFileName(sheet.subtitle)}.png`;
        zip.file(fileName, blob);
        pdfSheets.push({ sheet, imageData });
        (manifest.sheets as Array<Record<string, unknown>>).push({
          id: sheet.id,
          subtitle: sheet.subtitle,
          trimLabel: sheet.geometry.trimLabel,
          aspectRatio: sheet.geometry.aspectRatioLabel,
          fileName,
          status: sheet.status,
        });
      }

      let pdf: InstanceType<typeof jsPDF> | null = null;
      for (const [index, item] of pdfSheets.entries()) {
        const bleed = imageSettings().printBleedInches;
        const pageWidth = (item.sheet.geometry.width + bleed * 2) * 72;
        const pageHeight = (item.sheet.geometry.height + bleed * 2) * 72;
        const orientation = pageWidth > pageHeight ? "landscape" : "portrait";
        if (!pdf) {
          pdf = new jsPDF({
            orientation,
            unit: "pt",
            format: [pageWidth, pageHeight],
            compress: true,
          });
        } else {
          pdf.addPage([pageWidth, pageHeight], orientation);
        }
        pdf.addImage(
          item.imageData,
          "PNG",
          0,
          0,
          pageWidth,
          pageHeight,
          `package-sheet-${index}`,
          "FAST",
        );
      }
      if (pdf) {
        zip.file(
          `${slugifyFileName(finalStory()?.title ?? "mary-ann-stories-book")}.pdf`,
          pdf.output("arraybuffer"),
        );
      }

      zip.file("manifest.json", JSON.stringify(manifest, null, 2));
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `${slugifyFileName(finalStory()?.title ?? "mary-ann-stories-print-package")}.zip`;
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setExportPackageError(
        error instanceof Error
          ? error.message
          : "Unable to export the print package.",
      );
    } finally {
      setIsExportingPrintPackage(false);
    }
  };

  const renderBookEmulatorPlaceholder = (sheet: BookEmulatorSheet) => (
    <div class="book-layout-art-placeholder book-emulator-placeholder">
      <span class="detail-label">
        {sheet.kind === "cover"
          ? "Front cover waiting on art"
          : sheet.kind === "back_cover"
            ? "Back cover waiting on art"
            : `${sheet.label} waiting on art`}
      </span>
      <p>
        {sheet.kind === "page"
          ? "Generate and save this page in Images to drop it into the book emulator."
          : "Generate and save this cover in Images so it shows up in the emulator."}
      </p>
    </div>
  );

  const renderBookEmulatorSheet = (sheet: BookEmulatorSheet) => {
    const isStoryPage = sheet.kind === "page";
    const isSpread = sheet.kind === "page" && sheet.geometry.width > sheet.geometry.height;
    return (
      <div
        class={`book-emulator-sheet book-layout-canvas ${imageSettings().printShowSafeZone ? "show-safe-zone" : ""} ${isStoryPage ? `text-width-${sheet.layout.bookLayoutTextWidth} text-position-${sheet.layout.bookLayoutTextPosition} text-surface-${sheet.layout.bookLayoutTextSurface}` : "text-width-full text-position-bottom text-surface-floating"} ${sheet.imageUrl ? "has-art" : "empty"} ${sheet.kind} ${isSpread ? "spread" : "single"} ${bookEmulatorFlipDirection() === "forward" ? "flip-forward" : "flip-backward"}`}
        style={{
          "--layout-font-scale": String(sheet.layout.bookLayoutFontScale),
          "--layout-line-height": readAloudMode() ? "1.95" : "1.68",
          "--layout-font-family": getBookLayoutFont(sheet.layout.bookLayoutFont).family,
          "--layout-font-weight": String(
            getBookLayoutFontWeight(sheet.layout.bookLayoutFontWeight).weight,
          ),
          "--layout-offset-x": String(
            sheet.layout.bookLayoutTextWidth === "third"
              ? sheet.layout.bookLayoutHorizontalOffset
              : 0,
          ),
          "aspect-ratio": `${sheet.geometry.width} / ${sheet.geometry.height}`,
          "max-width": isSpread ? "1080px" : "620px",
        }}
      >
        <div class="book-layout-art-layer">
          <Show when={sheet.imageUrl} fallback={renderBookEmulatorPlaceholder(sheet)}>
            <img
              src={sheet.imageUrl!}
              alt={sheet.label}
              loading="lazy"
              decoding="async"
              fetchpriority="low"
            />
          </Show>
        </div>
        <Show when={imageSettings().printShowSafeZone}>
          <div class="book-layout-safe-guide" aria-hidden="true" />
        </Show>
        <Show when={isStoryPage && sheet.text.trim().length > 0}>
          <div class="book-layout-safe-area">
            <div class="book-layout-text-card">
              <p class="book-layout-copy">{sheet.text}</p>
            </div>
          </div>
        </Show>
        <Show when={sheet.kind === "back_cover"}>
          {renderBackCoverImprint("emulator")}
        </Show>
        <Show when={isSpread}>
          <div class="book-emulator-gutter" aria-hidden="true" />
        </Show>
      </div>
    );
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
    if (!resetImagesConfirmOpen() || typeof window === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancelResetImages();
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

  createEffect(() => {
    if (!explicitContentConfirmOpen() || typeof window === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeExplicitContentConfirm();
      }
    };
    window.addEventListener("keydown", handleKeydown);
    onCleanup(() => {
      window.removeEventListener("keydown", handleKeydown);
      document.body.style.overflow = previousOverflow;
    });
  });

  const loadMoreStoryDesk = () => {
    if (
      !authReady() ||
      storyDeskQuery().trim() ||
      !authUser() ||
      !authSession()
    ) {
      return;
    }
    if (homeShelfTab() === "published") {
      if (publishedStoryLoading() || !publishedStoryHasMore()) return;
      const nextPage = publishedStoryPage() + 1;
      void fetchPublishedStoriesPage(nextPage, "append");
      return;
    }
    if (storyDeskLoading() || !storyDeskHasMore()) return;
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

    if (activeTab() === "layout" && hasFinalGenerated()) {
      return "Layout ready";
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
  { label: "Book size", value: activeImageGeometry().trimLabel },
  { label: "Aspect ratio", value: activeImageGeometry().aspectRatioLabel },
  { label: "Output size", value: activeImageGeometry().pixelSizeLabel },
  { label: "Variations", value: String(imageSettings().variationCount) },
  {
    label: activeImageStep()?.kind === "back_cover" ? "Back cover focus" : "Cover focus",
    value: imageSettings().coverFocus,
  },
  { label: "Spread layout", value: getSpreadLayoutLabel(imageSettings().spreadLayout) },
  {
    label: "Image provider",
    value:
      imageSettings().imageProvider === "default"
        ? "Server default"
        : imageSettings().imageProvider === "gemini"
          ? "Gemini"
          : "OpenAI",
  },
  {
    label: "Image model",
    value:
      getImageModelOptions(imageSettings().imageProvider).find(
        (option) => option.id === imageSettings().imageModel,
      )?.label ?? "Server default",
  },
]);
  const activeBookSize = createMemo(() => getBookSize(imageSettings().bookSize));
  const activeSpreadLayout = createMemo(() =>
    spreadLayoutOptions.find((option) => option.id === imageSettings().spreadLayout),
  );
  const activeImageModelOptions = createMemo(() =>
    getImageModelOptions(imageSettings().imageProvider),
  );
  const activeImageModelLabel = createMemo(
    () =>
      activeImageModelOptions().find((option) => option.id === imageSettings().imageModel)
        ?.label ?? "Server default",
  );

  const payloadPreview = createMemo(() => JSON.stringify(builder(), null, 2));

  createEffect(() => {
    const mode = colorMode();

    applyColorMode(mode);

    if (typeof window !== "undefined") {
      window.localStorage.setItem("mary-ann-stories-color-mode", mode);
    }
  });

  createEffect(() => {
    const modelOptions = activeImageModelOptions();
    const selectedModel = imageSettings().imageModel;
    if (!modelOptions.some((option) => option.id === selectedModel)) {
      setImageSettings((current) => ({
        ...current,
        imageModel: "server-default",
      }));
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

  const handleAgeBandChange = (value: string) => {
    setBuilder((current) => ({
      ...current,
      ageBand: value,
      explicitContentEnabled:
        current.explicitContentEnabled || normalizeWhitespace(value) === adultAgeBand,
    }));
    setHasTouched(true);
    setReadyOverride(null);
  };

  const handleExplicitContentToggle = (enabled: boolean) => {
    setBuilder((current) => ({
      ...current,
      explicitContentEnabled: enabled,
      ageBand:
        !enabled && normalizeWhitespace(current.ageBand) === adultAgeBand
          ? ageBands[0]!
          : current.ageBand,
    }));
    setHasTouched(true);
    setReadyOverride(null);
  };

  const updateVisualField = <
    K extends
      | "artStyle"
      | "paletteDirection"
      | "lineWorkStyle"
      | "textureStyle"
      | "lightingStyle"
      | "characterDesignStyle",
  >(
    field: K,
    value: BuilderState[K],
  ) => {
    setBuilder((current) => ({
      ...current,
      [field]: value,
      visualPreset: current.visualPreset === "custom" ? current.visualPreset : "custom",
    }));
    setHasTouched(true);
    setReadyOverride(null);
  };

  const applyVisualPreset = (presetId: string) => {
    const preset = getVisualPreset(presetId);
    setBuilder((current) => ({
      ...current,
      visualPreset: preset.id,
      ...(preset.id === "custom" ? {} : preset.values),
    }));
    setHasTouched(true);
    setReadyOverride(null);
  };

  const addAdditionalCharacter = () => {
    setBuilder((current) => ({
      ...current,
      additionalCharacters: [
        ...current.additionalCharacters,
        { name: "", role: "", creatureType: "", gender: "" },
      ],
    }));
    setHasTouched(true);
    setReadyOverride(null);
  };

  const updateAdditionalCharacter = <K extends keyof AdditionalCharacter>(
    index: number,
    field: K,
    value: AdditionalCharacter[K],
  ) => {
    setBuilder((current) => {
      const next = [...current.additionalCharacters];
      const currentItem = next[index] ?? {
        name: "",
        role: "",
        creatureType: "",
        gender: "",
      };
      next[index] = { ...currentItem, [field]: value };
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

  const updateActivePageLayoutSettings = (patch: Partial<BookLayoutSettings>) => {
    const pageKey = `page-${finalPageIndex() + 1}`;
    setImageSettings((current) => {
      const layoutDefaults = getBookLayoutDefaultsFromImageSettings(current);
      const currentPageSettings = current.pageLayoutOverrides[pageKey] ?? layoutDefaults;
      return {
        ...current,
        pageLayoutOverrides: {
          ...current.pageLayoutOverrides,
          [pageKey]: normalizeBookLayoutSettings(
            {
              ...currentPageSettings,
              ...patch,
            },
            layoutDefaults,
          ),
        },
      };
    });
    setHasTouched(true);
    setReadyOverride(null);
  };

  const updateFinalStoryPageText = (pageIndex: number, value: string) => {
    setFinalStory((current) => {
      if (!current) return current;
      const nextPages = [...current.pages];
      nextPages[pageIndex] = value;
      return {
        ...current,
        pages: nextPages,
      };
    });
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

  const restoreImageVersion = (entry: ImageVersionEntry) => {
    const step = activeImageStep();
    if (!step) return;
    setImageStepResults((current) => ({
      ...current,
      [step.id]: {
        status: "generated",
        imageUrl: entry.imageUrl ?? entry.storedUrl,
        storedUrl: undefined,
        generatedAt: formatTimestamp(entry.createdAt),
        qaState: "idle",
        qaReport: undefined,
        qaError: undefined,
      },
    }));
    setImageStepLock(step.id, false);
    setImageStepQaReviewed(step.id, false);
    updateImagePromptOverride(step.id, entry.prompt);
    setHasGeneratedImages(true);
    setImageError(null);
    setAcceptError(null);
  };

  const toggleActiveImageLock = () => {
    const step = activeImageStep();
    if (!step) return;
    setImageStepLock(step.id, !activeImageLocked());
  };

  const markActiveImageQaReviewed = () => {
    const step = activeImageStep();
    if (!step) return;
    setImageStepQaReviewed(step.id, true);
  };

  const goBookEmulatorToIndex = (index: number) => {
    const sheets = bookEmulatorSheets();
    if (sheets.length === 0) return;
    const safeIndex = clampNumber(index, 0, sheets.length - 1);
    setBookEmulatorFlipDirection(safeIndex >= bookEmulatorIndex() ? "forward" : "backward");
    setBookEmulatorIndex(safeIndex);
  };

  const toggleBookEmulatorFullscreen = async () => {
    if (typeof document === "undefined") return;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    await bookEmulatorStageEl?.requestFullscreen?.().catch(() => undefined);
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
      const response = await authorizedFetch(`${apiBaseUrl}/api/stories/upsert`, {
        method: "POST",
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
    setExplicitContentConfirmOpen(false);
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

  const applyImageResetLocally = () => {
    setImageSettings((current) => ({
      ...current,
      lockedSteps: {},
      imageHistory: {},
      qaReviewedSteps: {},
      qaReviewNotes: {},
      promptOverrides: {},
    }));
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

  const requestResetImages = () => {
    setResetImagesError(null);
    setResetImagesConfirmOpen(true);
  };

  const cancelResetImages = () => {
    if (resetImagesBusy()) return;
    setResetImagesConfirmOpen(false);
    setResetImagesError(null);
  };

  const confirmResetImages = async () => {
    if (resetImagesBusy()) return;
    setResetImagesBusy(true);
    setResetImagesError(null);

    const storyId = activeStoryId();
    try {
      if (storyId) {
        const response = await authorizedFetch(`${apiBaseUrl}/api/images/reset`, {
          method: "POST",
          body: JSON.stringify({ story_id: storyId }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          setResetImagesError(data?.error ?? "Unable to reset saved images.");
          return;
        }
        lastFetchedImagesStoryId = null;
      }

      applyImageResetLocally();
      setResetImagesConfirmOpen(false);
      if (storyId) {
        void saveStory({ silent: true });
      }
    } catch (err) {
      setResetImagesError("Network error. Please try again.");
    } finally {
      setResetImagesBusy(false);
    }
  };

  const openDraftValidation = () => {
    setDraftValidationActive(true);
    setDraftValidationOpen(true);
  };

  const closeDraftValidation = () => {
    setDraftValidationOpen(false);
  };

  const closeExplicitContentConfirm = () => {
    setExplicitContentConfirmOpen(false);
  };

  const runDraftGeneration = async () => {
    if (isGenerating()) return;
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
      const response = await authorizedFetch(`${apiBaseUrl}/api/story/generate`, {
        method: "POST",
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

  const continueExplicitContentDraftRun = async () => {
    setExplicitContentConfirmOpen(false);
    await runDraftGeneration();
  };

  const handleGenerate = async () => {
    if (isGenerating()) return;
    if (!isDraftReady()) {
      setActiveTab("request");
      openDraftValidation();
      return;
    }
    if (isExplicitContentEnabled(builder())) {
      setExplicitContentConfirmOpen(true);
      return;
    }
    await runDraftGeneration();
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
      const response = await authorizedFetch(`${apiBaseUrl}/api/story/generate`, {
        method: "POST",
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
    if (imageSettings().lockedSteps[step.id] && imageStepResults()[step.id]?.status === "saved") {
      setImageError("This image is locked. Unlock it first if you want to regenerate it.");
      setIsGeneratingImages(false);
      return;
    }
    if (!isImageStepUnlocked(activeImageStepIndex())) {
      setImageError("Finish the previous image before generating this one.");
      setIsGeneratingImages(false);
      return;
    }

    const prompt = getEffectiveImagePrompt(step).trim();
    if (!prompt) {
      setImageError("Image prompt is empty. Add or restore a prompt before generating.");
      setIsGeneratingImages(false);
      return;
    }
    const geometry = getStepGeometry(imageSettings(), step);
    const size = geometry.openAiSize;
    const referenceImages = await Promise.all(
      getStepReferenceImages(step).map((reference) =>
        prepareReferenceImageForGeneration(reference),
      ),
    );

    try {
      const response = await authorizedFetch(`${apiBaseUrl}/api/images/generate`, {
        method: "POST",
        body: JSON.stringify({
          prompt,
          size,
          aspect_ratio: geometry.aspectRatioLabel,
          image_size: imageSettings().imageSize,
          negative_prompt: imagePlan().effectiveNegativePrompt,
          reference_image: referenceImages[0] ?? null,
          reference_images: referenceImages.length > 0 ? referenceImages : null,
          image_provider:
            imageSettings().imageProvider === "default"
              ? null
              : imageSettings().imageProvider,
          image_model:
            imageSettings().imageModel === "server-default"
              ? null
              : imageSettings().imageModel,
        }),
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
        const normalizedImageUrl = await normalizeImageToGeometry(
          imageUrl,
          geometry,
        );
        const historyEntry = createImageVersionEntry(
          step,
          prompt,
          { imageUrl: normalizedImageUrl },
          "generated",
        );
        setImageStepResults((current) => ({
          ...current,
          [step.id]: {
            status: "generated",
            imageUrl: normalizedImageUrl,
            generatedAt,
            qaState: "running",
            qaReport: undefined,
            qaError: undefined,
          },
        }));
        pushImageHistoryEntry(step.id, historyEntry);
        setImageStepQaReviewed(step.id, false);
        void runAutomatedImageQa(step, normalizedImageUrl, prompt, geometry);
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
      const response = await authorizedFetch(`${apiBaseUrl}/api/images/accept`, {
        method: "POST",
        body: JSON.stringify({
          story_id: storyId,
          image: imageRef,
          prompt: step.prompt,
          kind: step.kind,
          page_index: step.kind === "page" ? step.pageIndex ?? null : null,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setAcceptError(data?.error ?? "Unable to store the image.");
        return;
      }

      const storedUrl = normalizeClientImageUrl(
        typeof data?.url === "string" ? data.url : undefined,
      );
      const currentPrompt = activeImagePrompt().trim();
      const nextResult = {
        status: "saved" as const,
        imageUrl: normalizeClientImageUrl(result?.imageUrl ?? imageRef),
        storedUrl: storedUrl ?? normalizeClientImageUrl(imageRef),
        generatedAt: result?.generatedAt,
        qaState: result?.qaState,
        qaReport: result?.qaReport,
        qaError: result?.qaError,
      };
      setImageStepResults((current) => ({
        ...current,
        [step.id]: nextResult,
      }));
      pushImageHistoryEntry(
        step.id,
        createImageVersionEntry(step, currentPrompt, nextResult, "saved"),
      );
      setImageStepLock(step.id, true);
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
    if (authMode() === "register") {
      const passwordMessage = getRegistrationPasswordMessage(password);
      if (passwordMessage) {
        setAuthError(passwordMessage);
        return;
      }
    }

    setAuthBusy(true);
    try {
      const endpoint =
        authMode() === "register" ? "/api/auth/register" : "/api/auth/login";
      const response = await fetch(`${apiBaseUrl}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = (await response.json().catch(() => ({}))) as AuthApiResponse;

      if (!response.ok) {
        setAuthError(data.error ?? "Unable to authenticate.");
        return;
      }

      const cookieSession = await waitForAuthenticatedSession();
      if (!cookieSession) {
        setAuthError("Authentication succeeded, but the session cookie was not established.");
        return;
      }

      applyAuthenticatedSession(cookieSession);
      void fetchStoryDeskPageWithSession(0, "replace", cookieSession.username);
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

  const handleLogout = async () => {
    try {
      await fetch(`${apiBaseUrl}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
    } finally {
      expireAuthenticatedSession();
    }
  };

  return (
    <Show
      when={authReady() && authUser() && authSession()}
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
        <Suspense
          fallback={
            <section class="story-desk" aria-label="Story desk">
              <div class="panel-note panel-note-inline">Loading story desk…</div>
            </section>
          }
        >
          <StoryDeskHome
            homeShelfTab={homeShelfTab}
            setHomeShelfTab={setHomeShelfTab}
            storyDeskFilter={storyDeskFilter}
            setStoryDeskFilter={setStoryDeskFilter}
            storyDeskQuery={storyDeskQuery}
            setStoryDeskQuery={setStoryDeskQuery}
            activeHomeEntries={activeHomeEntries}
            activeHomeCounts={activeHomeCounts}
            activeHomeError={activeHomeError}
            filteredStoryDeskEntries={filteredStoryDeskEntries}
            openStudio={openStudio}
            setStoryDeskScrollEl={setStoryDeskScrollEl}
            selectedStoryId={selectedStoryId}
            selectStoryDeskEntry={selectStoryDeskEntry}
            activeHomeHasMore={activeHomeHasMore}
            activeHomeLoading={activeHomeLoading}
            setStoryDeskSentinel={setStoryDeskSentinel}
            activeStory={activeStory}
            publishedPreviewPageIndex={publishedPreviewPageIndex}
            setPublishedPreviewPageIndex={setPublishedPreviewPageIndex}
            activePublishedStoryPageCount={activePublishedStoryPageCount}
            activePublishedPreviewImage={activePublishedPreviewImage}
            activePublishedPreviewText={activePublishedPreviewText}
            requestStoryOpen={requestStoryOpen}
            requestDeleteStory={requestDeleteStory}
          />
        </Suspense>
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

                    <div class="field-grid">
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

                      <label class="field">
                        {renderFieldLabel("Creature type", false)}
                        <input
                          type="text"
                          placeholder="Human child, fox kit, dragon hatchling"
                          value={builder().creatureType}
                          onInput={(event) =>
                            updateField("creatureType", event.currentTarget.value)
                          }
                        />
                      </label>

                      <label class="field">
                        {renderFieldLabel("Gender", false)}
                        <select
                          value={builder().protagonistGender}
                          onInput={(event) =>
                            updateField("protagonistGender", event.currentTarget.value)
                          }
                        >
                          <option value="">Select gender</option>
                          <For each={genderOptions}>
                            {(gender) => <option value={gender}>{gender}</option>}
                          </For>
                        </select>
                      </label>

                      <label
                        class={`field field-span-2 ${
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
                          <Index each={builder().additionalCharacters}>
                            {(name, index) => (
                              <div class="character-row">
                                <div class="character-row-fields field-grid field-grid-4">
                                  <label class="field">
                                    {renderFieldLabel(
                                      `Additional character ${index + 1}`,
                                      false,
                                    )}
                                    <input
                                      type="text"
                                      placeholder="Name or nickname"
                                      value={name().name}
                                      onInput={(event) =>
                                        updateAdditionalCharacter(
                                          index,
                                          "name",
                                          event.currentTarget.value,
                                        )
                                      }
                                    />
                                  </label>
                                  <label class="field">
                                    {renderFieldLabel("Role", false)}
                                    <select
                                      value={name().role}
                                      onInput={(event) =>
                                        updateAdditionalCharacter(
                                          index,
                                          "role",
                                          event.currentTarget.value,
                                        )
                                      }
                                    >
                                      <option value="">Select role</option>
                                      <For each={supportingRoles}>
                                        {(role) => <option value={role}>{role}</option>}
                                      </For>
                                    </select>
                                  </label>
                                  <label class="field">
                                    {renderFieldLabel("Gender", false)}
                                    <select
                                      value={name().gender}
                                      onInput={(event) =>
                                        updateAdditionalCharacter(
                                          index,
                                          "gender",
                                          event.currentTarget.value,
                                        )
                                      }
                                    >
                                      <option value="">Select gender</option>
                                      <For each={genderOptions}>
                                        {(gender) => <option value={gender}>{gender}</option>}
                                      </For>
                                    </select>
                                  </label>
                                  <label class="field">
                                    {renderFieldLabel("Creature type", false)}
                                    <input
                                      type="text"
                                      placeholder="Rabbit, owl, robot"
                                      value={name().creatureType}
                                      onInput={(event) =>
                                        updateAdditionalCharacter(
                                          index,
                                          "creatureType",
                                          event.currentTarget.value,
                                        )
                                      }
                                    />
                                  </label>
                                </div>
                                <button
                                  class="character-remove"
                                  type="button"
                                  onClick={() => removeAdditionalCharacter(index)}
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </Index>
                        </div>
                      </Show>
                    </div>
                  </section>

                  <section class="request-subsection">
                    <p class="request-subsection-title">Story controls</p>

                    <div class="explicit-content-card">
                      <label class="explicit-content-toggle">
                        <input
                          type="checkbox"
                          checked={builder().explicitContentEnabled}
                          onInput={(event) =>
                            handleExplicitContentToggle(event.currentTarget.checked)}
                        />
                        <span>
                          <strong>Child safety override</strong>
                          <small>
                            Removes child-safe defaults from prompts and unlocks mature story
                            settings, including 18+.
                          </small>
                        </span>
                      </label>
                      <Show when={builder().explicitContentEnabled}>
                        <div class="explicit-content-note">
                          Mature themes can now be requested. Provider safety policies may still
                          limit some outputs even with this override enabled.
                        </div>
                      </Show>
                    </div>

                    <div class="field-grid field-grid-3">
                      <label class="field">
                        {renderFieldLabel("Age band", true)}
                        <select
                          value={builder().ageBand}
                          onInput={(event) => handleAgeBandChange(event.currentTarget.value)}
                        >
                          <For each={getAgeBandOptions(builder())}>
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

                    <label class="field">
                      {renderFieldLabel("Image provider", false)}
                      <select
                        value={imageSettings().imageProvider}
                        onInput={(event) =>
                          updateImageSetting(
                            "imageProvider",
                            event.currentTarget.value as ImageSettings["imageProvider"],
                          )
                        }
                      >
                        <For each={imageProviderOptions}>
                          {(option) => <option value={option.id}>{option.label}</option>}
                        </For>
                      </select>
                      <span class="field-help">
                        {
                          imageProviderOptions.find(
                            (option) => option.id === imageSettings().imageProvider,
                          )?.note ?? "Choose which image engine to use."
                        }
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

            <div class="field-grid-visual">
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
                  onInput={(event) => updateVisualField("artStyle", event.currentTarget.value)}
                >
                  <For each={artStyles}>{(item) => <option value={item}>{item}</option>}</For>
                </select>
              </label>

              <label class="field">
                {renderFieldLabel("Style preset", false)}
                <select
                  value={builder().visualPreset}
                  onInput={(event) => applyVisualPreset(event.currentTarget.value)}
                >
                  <For each={visualPresets}>
                    {(preset) => <option value={preset.id}>{preset.label}</option>}
                  </For>
                </select>
              </label>

              <label class="field">
                {renderFieldLabel("Palette direction", false)}
                <select
                  value={builder().paletteDirection}
                  onInput={(event) =>
                    updateVisualField("paletteDirection", event.currentTarget.value)
                  }
                >
                  <option value="">Use mood palette</option>
                  <For each={paletteDirections}>
                    {(item) => <option value={item}>{item}</option>}
                  </For>
                </select>
              </label>

              <label class="field">
                {renderFieldLabel("Line work", false)}
                <select
                  value={builder().lineWorkStyle}
                  onInput={(event) => updateVisualField("lineWorkStyle", event.currentTarget.value)}
                >
                  <option value="">Use style default</option>
                  <For each={lineWorkStyles}>
                    {(item) => <option value={item}>{item}</option>}
                  </For>
                </select>
              </label>

              <label class="field">
                {renderFieldLabel("Texture / detailing", false)}
                <select
                  value={builder().textureStyle}
                  onInput={(event) => updateVisualField("textureStyle", event.currentTarget.value)}
                >
                  <option value="">Use style default</option>
                  <For each={textureStyles}>
                    {(item) => <option value={item}>{item}</option>}
                  </For>
                </select>
              </label>

              <label class="field">
                {renderFieldLabel("Lighting", false)}
                <select
                  value={builder().lightingStyle}
                  onInput={(event) => updateVisualField("lightingStyle", event.currentTarget.value)}
                >
                  <option value="">Use style default</option>
                  <For each={lightingStyles}>
                    {(item) => <option value={item}>{item}</option>}
                  </For>
                </select>
              </label>

              <label class="field">
                {renderFieldLabel("Character rendering", false)}
                <select
                  value={builder().characterDesignStyle}
                  onInput={(event) =>
                    updateVisualField("characterDesignStyle", event.currentTarget.value)
                  }
                >
                  <option value="">Use style default</option>
                  <For each={characterDesignStyles}>
                    {(item) => <option value={item}>{item}</option>}
                  </For>
                </select>
              </label>
            </div>

            <p class="footer-note">
              {getVisualPreset(builder().visualPreset).description}
            </p>

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
        <Suspense
          fallback={
            <section class="image-workspace" role="tabpanel" aria-label="Image generation">
              <div class="panel image-panel">
                <div class="panel-note panel-note-inline">Loading image workspace…</div>
              </div>
            </section>
          }
        >
          <ImagesWorkspace
            imageSteps={imageSteps}
            activeImageStepIndex={activeImageStepIndex}
            imageStepResults={imageStepResults}
            setActiveImageStepIndex={setActiveImageStepIndex}
            setImageError={setImageError}
            setAcceptError={setAcceptError}
            isImageStepUnlocked={isImageStepUnlocked}
            imageProgress={imageProgress}
            finalStory={finalStory}
            imageMetaCards={imageMetaCards}
            activeImageStep={activeImageStep}
            imageSettings={imageSettings}
            resetImagePromptOverride={resetImagePromptOverride}
            activeImagePrompt={activeImagePrompt}
            activeImageLocked={activeImageLocked}
            activeImageResult={activeImageResult}
            updateImagePromptOverride={updateImagePromptOverride}
            hasGeneratedImages={hasGeneratedImages}
            handleGenerateImages={handleGenerateImages}
            isGeneratingImages={isGeneratingImages}
            handleAcceptImage={handleAcceptImage}
            canAcceptActiveImage={canAcceptActiveImage}
            isAcceptingImage={isAcceptingImage}
            activeImageQaStatus={activeImageQaStatus}
            activeImageNeedsQaBlockerReview={activeImageNeedsQaBlockerReview}
            toggleActiveImageLock={toggleActiveImageLock}
            requestResetImages={requestResetImages}
            setActiveTab={setActiveTab}
            activeImageModelOptions={activeImageModelOptions}
            updateImageSetting={updateImageSetting}
            activeImageModelLabel={activeImageModelLabel}
            imageError={imageError}
            acceptError={acceptError}
            lastImagesGeneratedAt={lastImagesGeneratedAt}
            activeImageQaReviewed={activeImageQaReviewed}
            activeImageQaReport={activeImageQaReport}
            markActiveImageQaReviewed={markActiveImageQaReviewed}
            activeImageQaWarnings={activeImageQaWarnings}
            renderFieldLabel={renderFieldLabel}
            activeImageQaReviewNote={activeImageQaReviewNote}
            updateImageQaReviewNote={updateImageQaReviewNote}
            activeImageHistory={activeImageHistory}
            formatTimestamp={formatTimestamp}
            restoreImageVersion={restoreImageVersion}
            activeImageUrl={activeImageUrl}
            openGeneratedModal={openGeneratedModal}
            showBackCoverPreviewImprint={showBackCoverPreviewImprint}
            renderBackCoverImprint={renderBackCoverImprint}
          />
        </Suspense>
      </Show>

      <Show when={activeTab() === "layout"}>
        <Suspense
          fallback={
            <section class="layout-studio" role="tabpanel" aria-label="Book layout preview">
              <div class="panel layout-studio-panel">
                <div class="panel-note panel-note-inline">Loading layout studio…</div>
              </div>
            </section>
          }
        >
          <LayoutStudio
            finalStory={finalStory}
            finalError={finalError}
            finalPageIndex={finalPageIndex}
            setFinalPageIndex={setFinalPageIndex}
            setActiveTab={setActiveTab}
            activeLayoutStatusMeta={activeLayoutStatusMeta}
            renderFieldLabel={renderFieldLabel}
            activeLayoutSettings={activeLayoutSettings}
            updateActivePageLayoutSettings={updateActivePageLayoutSettings}
            getDefaultTextPositionForWidth={getDefaultTextPositionForWidth}
            bookLayoutTextWidthOptions={bookLayoutTextWidthOptions}
            activeLayoutTextWidth={activeLayoutTextWidth}
            activeLayoutPositionOptions={activeLayoutPositionOptions}
            activeLayoutPositionNote={activeLayoutPositionNote}
            bookLayoutTextSurfaceOptions={bookLayoutTextSurfaceOptions}
            activeLayoutTextSurface={activeLayoutTextSurface}
            bookLayoutFontOptions={bookLayoutFontOptions}
            activeLayoutFont={activeLayoutFont}
            bookLayoutFontWeightOptions={bookLayoutFontWeightOptions}
            activeLayoutFontWeight={activeLayoutFontWeight}
            readAloudMode={readAloudMode}
            setReadAloudMode={setReadAloudMode}
            activeLayoutGeometry={activeLayoutGeometry}
            activeLayoutResult={activeLayoutResult}
            imageSettings={imageSettings}
            activeLayoutStep={activeLayoutStep}
            activeLayoutImageUrl={activeLayoutImageUrl}
            activeLayoutPageText={activeLayoutPageText}
            updateFinalStoryPageText={updateFinalStoryPageText}
            builder={builder}
            updateImageSetting={updateImageSetting}
            resolvedBackCoverQrUrl={resolvedBackCoverQrUrl}
            publishValidation={publishValidation}
            clampNumber={clampNumber}
            handleExportPdf={handleExportPdf}
            isExportingPdf={isExportingPdf}
            handleExportPrintPackage={handleExportPrintPackage}
            isExportingPrintPackage={isExportingPrintPackage}
            exportPdfError={exportPdfError}
            exportPackageError={exportPackageError}
            bookEmulatorSheets={bookEmulatorSheets}
            bookEmulatorActiveSheet={bookEmulatorActiveSheet}
            bookEmulatorStatusMeta={bookEmulatorStatusMeta}
            bookEmulatorIndex={bookEmulatorIndex}
            goBookEmulatorPrev={goBookEmulatorPrev}
            goBookEmulatorNext={goBookEmulatorNext}
            goBookEmulatorToIndex={goBookEmulatorToIndex}
            toggleBookEmulatorFullscreen={toggleBookEmulatorFullscreen}
            isBookEmulatorFullscreen={isBookEmulatorFullscreen}
            bookEmulatorStageRef={(element: HTMLElement) => (bookEmulatorStageEl = element)}
            renderBookEmulatorSheet={renderBookEmulatorSheet}
          />
        </Suspense>
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
                <p class="subtle-text">{normalizeMetadataLine(finalStory()!.subtitle)}</p>
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
                <div class="image-modal-art-stage">
                  <img
                    src={item().imageUrl}
                    alt={item().title}
                    loading="eager"
                    decoding="async"
                    fetchpriority="high"
                  />
                  <Show when={isBackCoverModalItem(item())}>
                    {renderBackCoverImprint("modal")}
                  </Show>
                </div>
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
      <Show when={resetImagesConfirmOpen()}>
        <div class="confirm-modal" role="dialog" aria-modal="true" onClick={cancelResetImages}>
          <div
            class="confirm-card"
            role="document"
            onClick={(event) => event.stopPropagation()}
          >
            <div class="confirm-header">
              <p class="panel-kicker">Reset images</p>
              <h3>Reset all generated images for this story?</h3>
              <p class="subtle-text">
                This will remove saved cover and page images from the queue and story
                library.
              </p>
            </div>
            <Show when={resetImagesError()}>
              <div class="panel-note panel-note-inline">{resetImagesError()}</div>
            </Show>
            <div class="confirm-actions">
              <button class="button ghost" type="button" onClick={cancelResetImages}>
                Cancel
              </button>
              <button
                class="button primary"
                type="button"
                onClick={confirmResetImages}
                disabled={resetImagesBusy()}
              >
                {resetImagesBusy() ? "Resetting..." : "Reset images"}
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
      <Show when={explicitContentConfirmOpen()}>
        <div
          class="confirm-modal"
          role="dialog"
          aria-modal="true"
          onClick={closeExplicitContentConfirm}
        >
          <div
            class="confirm-card"
            role="document"
            onClick={(event) => event.stopPropagation()}
          >
            <div class="confirm-header">
              <p class="panel-kicker">Explicit content warning</p>
              <h3>Continue with child safety override enabled?</h3>
              <p class="subtle-text">
                This draft can now include violence, sexual material, and other adult themes if
                they are present in your premise or direction. Continue only if that is your
                intent.
              </p>
            </div>
            <div class="panel-note panel-note-inline">
              Provider policies may still block or soften some explicit outputs even when this
              override is enabled.
            </div>
            <div class="confirm-actions">
              <button class="button ghost" type="button" onClick={closeExplicitContentConfirm}>
                Cancel
              </button>
              <button
                class="button primary"
                type="button"
                onClick={continueExplicitContentDraftRun}
              >
                Continue anyway
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
