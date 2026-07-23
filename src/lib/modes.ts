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
    description: "Private career, song, release, group, brand, market, and deal consultation.",
    instruction:
      "Operate as Trey Trizzy and TRACE's private inside A&R executive. Diagnose honestly, verify current facts, cite live research, protect rights, and prioritize durable leverage over empty activity.",
    kind: "consultation",
  },
];

export const AR_CONSULTATION_FOCUSES: ArConsultationFocus[] = [
  {
    id: "quick-verdict",
    name: "Quick A&R Verdict",
    description: "Rapid decision, strongest reason, biggest concern, next action, and confidence.",
    starter:
      "Give me a Quick A&R Verdict. State the decision first, the strongest reason, the biggest concern, the best next action, and your confidence level.",
  },
  {
    id: "career-audit",
    name: "Career Consultation",
    description: "Executive diagnosis, strengths, vulnerabilities, leverage, distractions, and sequencing.",
    starter:
      "Audit my current solo career position. Identify my strongest assets, vulnerabilities, highest-leverage opportunity, biggest distraction, 30-day move, 90-day move, and one-year implication.",
  },
  {
    id: "song-evaluation",
    name: "Song Meeting",
    description: "100-point A&R score, song job, hook, identity, revisions, test, and release verdict.",
    starter:
      "Run a full Song Meeting on this record. Classify its job, give the current and potential 100-point scores, identify the strongest and weakest moments, decide whether it belongs to Trey or TRACE, and tell me exactly what must change before release.",
  },
  {
    id: "release-strategy",
    name: "Release Room",
    description: "Release objective, positioning, timeline, assets, content, conversion, risks, and measurement.",
    starter:
      "Run a Release Room for this record using my verified current catalog, audience signals, asset readiness, budget reality, competing priorities, and the present music market.",
  },
  {
    id: "trace-development",
    name: "TRACE Group Meeting",
    description: "Member balance, vocal allocation, visuals, chemistry, audience, repertoire, disclosure, and rights.",
    starter:
      "Run a TRACE Group Meeting. Evaluate the group objective, member balance, vocal allocation, visual identity, chemistry, audience signal, song and content strategy, virtual-member disclosure, rights readiness, and next three actions.",
  },
  {
    id: "brand-content",
    name: "Brand + Content",
    description: "Public journey, brand separation, narrative, content formats, conversion, and visual consistency.",
    starter:
      "Audit my public presence, brand separation, strongest narrative, contradictions, repeatable content formats, conversion gaps, and the next three assets I should make.",
  },
  {
    id: "deal-business",
    name: "Deal Desk",
    description: "Strategic value, economics, rights, control, risk clauses, negotiation, walk-away points, and counsel review.",
    starter:
      "Run this opportunity through the Deal Desk. Explain what is offered, strategic value, financial structure, rights requested, control lost, risk clauses, negotiation priorities, walk-away conditions, and attorney-review items.",
  },
  {
    id: "weekly-intelligence",
    name: "Weekly Intelligence Report",
    description: "Current industry, R&B/pop, platform, AI-rights, campaign, opportunity, and threat intelligence.",
    starter:
      "Prepare this week's intelligence report for Trey Trizzy and TRACE. Cover material industry developments, R&B and pop movement, platform changes, AI and rights issues, relevant campaigns, opportunities, threats, and the one action that matters most this week.",
  },
  {
    id: "first-run-assignment",
    name: "First-Run Assignment",
    description: "Full current public audit, catalog and TRACE status, assets, vulnerabilities, and 30/90-day plan.",
    starter:
      "Enter First-Run A&R Assignment mode. Audit Trey Trizzy's current public artist presence, verify the actual release priority, identify stale or conflicting pages, map the catalog, separate solo and TRACE opportunities, establish TRACE's launch status and member profiles, identify the three strongest assets and vulnerabilities, and produce a practical 30-day and 90-day plan. Complete as much as possible from verified information before requesting private analytics or files.",
  },
];

export function getWritingMode(id: ModeId): WritingMode {
  return WRITING_MODES.find((mode) => mode.id === id) ?? WRITING_MODES[0];
}

export function getArConsultationFocus(id?: ArConsultationFocusId): ArConsultationFocus {
  return AR_CONSULTATION_FOCUSES.find((focus) => focus.id === id) ?? AR_CONSULTATION_FOCUSES[0];
}
