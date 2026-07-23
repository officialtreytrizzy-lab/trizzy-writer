import type { ArConsultationFocusId, ModeId } from "./types";

export type WritingMode = {
  id: ModeId;
  name: string;
  description: string;
  instruction: string;
  kind: "writing" | "consultation";
};

export type ArConsultationFocus = {
  id: ArConsultationFocusId;
  name: string;
  description: string;
  starter: string;
};

export const WRITING_MODES: WritingMode[] = [
  {
    id: "full-song",
    name: "Full Song",
    description: "Create a complete performance-ready record.",
    instruction:
      "Write a complete song with a strong opening, distinct verses, a memorable hook, purposeful transitions, and no filler.",
    kind: "writing",
  },
  {
    id: "cadence-remix",
    name: "Cadence Remix",
    description: "Rewrite while preserving the source flow.",
    instruction:
      "Preserve line count, stress pattern, approximate syllable count, rhyme placement, pauses, and performance cadence.",
    kind: "writing",
  },
  {
    id: "hook-lab",
    name: "Hook Lab",
    description: "Build a sticky replayable hook.",
    instruction:
      "Prioritize concise melodic language, natural repetition, strong vowel sounds, quotable phrasing, and immediate emotional clarity.",
    kind: "writing",
  },
  {
    id: "bar-polish",
    name: "Bar Polish",
    description: "Upgrade weak bars without losing the idea.",
    instruction:
      "Preserve the meaning and voice while upgrading imagery, internal rhyme, punchlines, natural phrasing, and replay value.",
    kind: "writing",
  },
  {
    id: "locked-revision",
    name: "Locked Revision",
    description: "Change only what was requested.",
    instruction:
      "Perform a surgical revision. Alter only the material explicitly targeted and preserve every other supplied line exactly.",
    kind: "writing",
  },
  {
    id: "inside-ar",
    name: "Inside A&R",
    description: "Private career, song, release, group, brand, and deal consultation.",
    instruction:
      "Operate as Trey Trizzy and TRACE's private inside A&R executive. Diagnose honestly, verify current facts, cite live research, and give prioritized actions rather than generic encouragement.",
    kind: "consultation",
  },
];

export const AR_CONSULTATION_FOCUSES: ArConsultationFocus[] = [
  {
    id: "career-audit",
    name: "Career Audit",
    description: "Positioning, catalog, audience, leverage, gaps, and next moves.",
    starter:
      "Audit my current solo career position. Tell me what is working, what is confusing, what is holding me back, and the highest-leverage moves for the next 30 and 90 days.",
  },
  {
    id: "song-evaluation",
    name: "Song Evaluation",
    description: "A&R score, hook, identity, market fit, revisions, and release readiness.",
    starter:
      "Evaluate this song like a demanding label A&R. Score the record, identify the strongest commercial and emotional assets, flag the weak points, and tell me exactly what must change before release.",
  },
  {
    id: "release-strategy",
    name: "Release Strategy",
    description: "Single choice, sequencing, rollout, content, conversion, and measurement.",
    starter:
      "Build the strongest release strategy for this record using my real current catalog, audience signals, content strengths, budget reality, and the present music market.",
  },
  {
    id: "trace-development",
    name: "TRACE Development",
    description: "Group identity, member roles, songs, visuals, audience, and virtual-member rules.",
    starter:
      "Evaluate TRACE as a Memphis R&B group. Strengthen the group identity, member roles, repertoire, audience position, visual world, disclosure language, and next development priorities.",
  },
  {
    id: "brand-content",
    name: "Brand + Content",
    description: "Narrative, public presence, social formats, conversion, and visual consistency.",
    starter:
      "Audit my brand and content like an A&R working with marketing. Identify the clearest story, strongest repeatable formats, public inconsistencies, conversion gaps, and the content I should make next.",
  },
  {
    id: "deal-business",
    name: "Deal + Business",
    description: "Offers, rights, splits, distribution, publishing, risk, and leverage.",
    starter:
      "Review this opportunity from an artist-first A&R and business perspective. Explain the upside, hidden costs, rights risks, leverage, missing terms, questions to ask, and walk-away points.",
  },
  {
    id: "first-run-assignment",
    name: "First-Run Assignment",
    description: "Full current audit plus prioritized 30-day and 90-day plan.",
    starter:
      "Enter First-Run A&R Assignment mode. Conduct a current public audit of Trey Trizzy and TRACE, verify all release statuses, identify contradictions, evaluate the current positioning of both brands, and produce a prioritized 30-day and 90-day development plan. Date every external fact and distinguish verified information from assumptions.",
  },
];

export function getWritingMode(id: ModeId): WritingMode {
  return WRITING_MODES.find((mode) => mode.id === id) ?? WRITING_MODES[0];
}

export function getArConsultationFocus(id?: ArConsultationFocusId): ArConsultationFocus {
  return AR_CONSULTATION_FOCUSES.find((focus) => focus.id === id) ?? AR_CONSULTATION_FOCUSES[0];
}
