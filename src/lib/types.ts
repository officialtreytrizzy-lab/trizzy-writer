export const MODE_IDS = [
  "full-song",
  "cadence-remix",
  "hook-lab",
  "bar-polish",
  "locked-revision",
  "inside-ar",
] as const;

export type ModeId = (typeof MODE_IDS)[number];

export const CONTENT_LEVELS = ["clean", "explicit", "raw-adult"] as const;
export type ContentLevel = (typeof CONTENT_LEVELS)[number];

export const AR_CONSULTATION_FOCUS_IDS = [
  "career-audit",
  "song-evaluation",
  "release-strategy",
  "trace-development",
  "brand-content",
  "deal-business",
  "first-run-assignment",
] as const;

export type ArConsultationFocusId = (typeof AR_CONSULTATION_FOCUS_IDS)[number];

export type ResearchSource = {
  id: string;
  title: string;
  url: string;
  source: string;
  excerpt: string;
  publishedAt?: string;
  query: string;
  kind: "official" | "web" | "news";
};

export type ResearchPacket = {
  asOf: string;
  sources: ResearchSource[];
  warnings: string[];
};

export type GenerateRequest = {
  mode: ModeId;
  prompt: string;
  sourceLyrics: string;
  lockedLyrics: string;
  maxCharacters: number;
  creativity: number;
  contentLevel: ContentLevel;
  consultationFocus?: ArConsultationFocusId;
  liveResearch?: boolean;
};

export type GenerateResponse = {
  text: string;
  model: string;
  provider: string;
  repaired: boolean;
  warnings: string[];
  research?: ResearchPacket;
};

export type DecisionStatus = "approved" | "rejected";
export type TechniqueRatings = Record<string, number>;

export type DecisionRecord = GenerateRequest & {
  id: string;
  output: string;
  status: DecisionStatus;
  createdAt: string;
  model: string;
  originalOutput?: string;
  userRatings?: TechniqueRatings;
  userNotes?: string;
  lyricAnalysis?: import("./lyric-analysis").LyricAnalysis;
  research?: ResearchPacket;
};
