export const MODE_IDS = [
  "full-song",
  "cadence-remix",
  "hook-lab",
  "bar-polish",
  "locked-revision",
] as const;

export type ModeId = (typeof MODE_IDS)[number];

export const CONTENT_LEVELS = ["clean", "explicit", "raw-adult"] as const;
export type ContentLevel = (typeof CONTENT_LEVELS)[number];

export type GenerateRequest = {
  mode: ModeId;
  prompt: string;
  sourceLyrics: string;
  lockedLyrics: string;
  maxCharacters: number;
  creativity: number;
  contentLevel: ContentLevel;
};

export type GenerateResponse = {
  text: string;
  model: string;
  provider: string;
  repaired: boolean;
  warnings: string[];
};

export type DecisionStatus = "approved" | "rejected";

export type DecisionRecord = GenerateRequest & {
  id: string;
  output: string;
  status: DecisionStatus;
  createdAt: string;
  model: string;
};
