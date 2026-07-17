import type { ModeId } from "./types";

export type WritingMode = {
  id: ModeId;
  name: string;
  description: string;
  instruction: string;
};

export const WRITING_MODES: WritingMode[] = [
  {
    id: "full-song",
    name: "Full Song",
    description: "Create a complete performance-ready record.",
    instruction:
      "Write a complete song with a strong opening, distinct verses, a memorable hook, purposeful transitions, and no filler.",
  },
  {
    id: "cadence-remix",
    name: "Cadence Remix",
    description: "Rewrite while preserving the source flow.",
    instruction:
      "Preserve line count, stress pattern, approximate syllable count, rhyme placement, pauses, and performance cadence.",
  },
  {
    id: "hook-lab",
    name: "Hook Lab",
    description: "Build a sticky replayable hook.",
    instruction:
      "Prioritize concise melodic language, natural repetition, strong vowel sounds, quotable phrasing, and immediate emotional clarity.",
  },
  {
    id: "bar-polish",
    name: "Bar Polish",
    description: "Upgrade weak bars without losing the idea.",
    instruction:
      "Preserve the meaning and voice while upgrading imagery, internal rhyme, punchlines, natural phrasing, and replay value.",
  },
  {
    id: "locked-revision",
    name: "Locked Revision",
    description: "Change only what was requested.",
    instruction:
      "Perform a surgical revision. Alter only the material explicitly targeted and preserve every other supplied line exactly.",
  },
];

export function getWritingMode(id: ModeId): WritingMode {
  return WRITING_MODES.find((mode) => mode.id === id) ?? WRITING_MODES[0];
}
