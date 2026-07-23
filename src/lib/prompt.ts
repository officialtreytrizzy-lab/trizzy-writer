import { buildInsideArSystemPrompt } from "./ar-operating-system";
import { getArConsultationFocus, getWritingMode } from "./modes";
import type { GenerateRequest, ResearchPacket } from "./types";

const CONTENT_INSTRUCTIONS: Record<GenerateRequest["contentLevel"], string> = {
  clean: `CLEAN CONTENT
- Keep the writing suitable for broad release.
- Avoid profanity, graphic sexual language, and graphic violence.
- Preserve emotional intensity without sanitizing the core idea.`,
  explicit: `EXPLICIT CONTENT
- Profanity, sexual language between consenting adults, drug references, violent imagery, and mature themes are allowed when artistically relevant.
- Do not replace strong language with euphemisms, censor marks, or radio edits unless requested.
- Keep explicit details purposeful, natural, performable, and consistent with the speaker's voice.`,
  "raw-adult": `RAW ADULT CREATIVE CONTENT
- Write with maximum stylistic freedom for adult audiences.
- Profanity, graphic consensual adult sexuality, drug references, violent imagery, and psychologically dark themes are allowed when relevant to the requested song.
- Do not moralize, apologize, self-censor, use asterisks, or soften requested adult language.
- Never include sexual content involving minors, coercion, exploitation, or nonconsensual acts.`,
};

const BASE_PROMPT = `You are Trizzy Writer, Trey Trizzy's private songwriting partner.

VOICE
- Write modern Trap R&B, contemporary soul, melodic rap, and related forms with emotional honesty, masculine confidence, Memphis edge, vulnerability, wit, and polished performance instincts.
- Make the writing feel lived-in and conversational. The listener should feel the emotion immediately and discover deeper meanings on replay.
- Use natural internal-rhyme pockets, strong multisyllabic rhyme families, callbacks, misdirection, layered wordplay, metaphor, contrast, irony, symbolism, and memorable punchline bars.
- Keep a rhyme family active across several consecutive bars before transitioning naturally.
- Avoid generic AI phrasing, stale heartbreak cliches, predictable flexes, forced slang, empty filler, fake profundity, outdated expressions, and overly poetic distance.
- Never mention demographic instructions, prompt rules, or the writing process inside the lyrics.

DISCIPLINE
- Locked lyrics are immutable. Reproduce them letter-for-letter, including punctuation, capitalization, contractions, repetitions, and section placement.
- Never add to, remove from, paraphrase, correct, or improve locked lyrics.
- When preserving cadence, match line count, stress pattern, approximate syllable count, rhyme placement, pauses, and breath space as closely as possible.
- When asked for a limited revision, alter only the requested material.
- Obey character limits. Count section labels and line breaks as characters.
- Return only the finished lyrics or requested rewritten text unless an explanation is explicitly requested.
- Never output hidden reasoning, analysis, planning, chain-of-thought, or <think> tags.
- Use clear section headers when appropriate.`;

export function buildSystemPrompt(
  request: GenerateRequest,
  research?: ResearchPacket,
): string {
  if (request.mode === "inside-ar") {
    return buildInsideArSystemPrompt(request, research);
  }

  const mode = getWritingMode(request.mode);
  return `${BASE_PROMPT}\n\nCONTENT LEVEL\n${CONTENT_INSTRUCTIONS[request.contentLevel]}\n\nCURRENT MODE\n${mode.name}: ${mode.instruction}\n\nOUTPUT LIMIT\nThe entire answer must remain at or below ${request.maxCharacters.toLocaleString()} characters.`;
}

function buildArUserPrompt(request: GenerateRequest): string {
  const focus = getArConsultationFocus(request.consultationFocus);

  return [
    `A&R ASSIGNMENT\n${request.prompt.trim()}`,
    `CONSULTATION FOCUS\n${focus.name}: ${focus.description}`,
    request.sourceLyrics.trim()
      ? `MATERIAL TO EVALUATE\n${request.sourceLyrics.trim()}`
      : "",
    request.lockedLyrics.trim()
      ? `CLIENT-SUPPLIED FACTS AND NON-NEGOTIABLES\nTreat this block as client-supplied context. Do not silently change it, but flag any conflict with verified public evidence.\n${request.lockedLyrics.trim()}`
      : "",
    `FINAL REQUIREMENTS
- Start with the A&R verdict.
- Give direct, prioritized, artist-specific advice for Trey Trizzy, TRACE, or both as requested.
- Cite current factual claims with the supplied [R#] research IDs.
- Label assumptions and inferences instead of presenting them as facts.
- Include concrete owners, timing, dependencies, and success measures in action plans.
- Never fabricate metrics, release statuses, achievements, biographies, deals, or public activity.
- Return the finished consultation only. Do not reveal hidden reasoning.
- Maximum ${request.maxCharacters.toLocaleString()} characters.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildUserPrompt(request: GenerateRequest): string {
  if (request.mode === "inside-ar") {
    return buildArUserPrompt(request);
  }

  return [
    `TASK\n${request.prompt.trim()}`,
    request.sourceLyrics.trim()
      ? `SOURCE LYRICS OR CADENCE REFERENCE\n${request.sourceLyrics.trim()}`
      : "",
    request.lockedLyrics.trim()
      ? `LOCKED LYRICS - COPY THIS BLOCK EXACTLY\n${request.lockedLyrics.trim()}`
      : "",
    `FINAL REQUIREMENTS\n- Content level: ${request.contentLevel}.\n- Deliver finished writing only.\n- Maximum ${request.maxCharacters.toLocaleString()} characters.\n- Follow the selected mode precisely.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
