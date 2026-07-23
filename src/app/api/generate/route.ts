import { NextResponse } from "next/server";
import { z } from "zod";
import { generateWithModel } from "@/lib/model";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompt";
import { buildCurrentResearchPacket } from "@/lib/research";
import {
  AR_CONSULTATION_FOCUS_IDS,
  CONTENT_LEVELS,
  MODE_IDS,
  type GenerateRequest,
  type GenerateResponse,
  type ResearchPacket,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const requestSchema = z.object({
  mode: z.enum(MODE_IDS),
  prompt: z.string().trim().min(1).max(12000),
  sourceLyrics: z.string().max(30000).default(""),
  lockedLyrics: z.string().max(15000).default(""),
  maxCharacters: z.number().int().min(300).max(12000),
  creativity: z.number().min(0).max(1.2),
  contentLevel: z.enum(CONTENT_LEVELS).default("explicit"),
  consultationFocus: z.enum(AR_CONSULTATION_FOCUS_IDS).default("career-audit"),
  liveResearch: z.boolean().default(true),
});

function containsLockedText(text: string, request: GenerateRequest): boolean {
  if (request.mode === "inside-ar") return true;
  const locked = request.lockedLyrics.trim();
  return !locked || text.includes(locked);
}

function tokenBudgetForCharacters(maxCharacters: number, mode: GenerateRequest["mode"]): number {
  const ceiling = mode === "inside-ar" ? 2400 : 1800;
  return Math.min(ceiling, Math.max(96, Math.ceil(maxCharacters / 3.5) + 48));
}

async function repairDraft(
  request: GenerateRequest,
  draft: string,
  problems: string[],
  research?: ResearchPacket,
): Promise<{ text: string; model: string; provider: string }> {
  const repairPrompt = [
    request.mode === "inside-ar"
      ? "Repair the A&R consultation below without changing its evidence standard or strategic conclusion unless needed for accuracy."
      : "Repair the draft below.",
    ...problems.map((problem) => `- ${problem}`),
    `- Keep the final response at or below ${request.maxCharacters} characters.`,
    request.mode === "inside-ar"
      ? "- Preserve valid [R#] citations and remove any current factual claim that lacks support."
      : "- Return only the repaired final writing.",
    request.mode !== "inside-ar" && request.lockedLyrics.trim()
      ? `- Include this locked block exactly:\n${request.lockedLyrics.trim()}`
      : "",
    `DRAFT TO REPAIR\n${draft}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return generateWithModel(
    [
      { role: "system", content: buildSystemPrompt(request, research) },
      { role: "user", content: repairPrompt },
    ],
    Math.max(0.2, request.creativity - 0.2),
    undefined,
    { maxTokens: tokenBudgetForCharacters(request.maxCharacters, request.mode) },
  );
}

export async function POST(
  requestObject: Request,
): Promise<NextResponse<GenerateResponse | { error: string }>> {
  try {
    const rawBody: unknown = await requestObject.json();
    const parsed = requestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid generation request." },
        { status: 400 },
      );
    }

    const request: GenerateRequest = parsed.data;
    const research =
      request.mode === "inside-ar" && request.liveResearch
        ? await buildCurrentResearchPacket(request)
        : undefined;
    const maxTokens = tokenBudgetForCharacters(request.maxCharacters, request.mode);

    let result = await generateWithModel(
      [
        { role: "system", content: buildSystemPrompt(request, research) },
        { role: "user", content: buildUserPrompt(request) },
      ],
      request.creativity,
      requestObject.signal,
      { maxTokens },
    );

    const repairProblems: string[] = [];
    if (result.text.length > request.maxCharacters) {
      repairProblems.push(
        `Reduce the draft from ${result.text.length} characters to no more than ${request.maxCharacters}.`,
      );
    }
    if (!containsLockedText(result.text, request)) {
      repairProblems.push("The locked lyrics were changed, omitted, or separated. Restore the exact block.");
    }

    let repaired = false;
    if (repairProblems.length > 0) {
      result = await repairDraft(request, result.text, repairProblems, research);
      repaired = true;
    }

    const warnings: string[] = [];
    if (result.text.length > request.maxCharacters) {
      warnings.push(
        `The response remains ${result.text.length - request.maxCharacters} characters over the limit.`,
      );
    }
    if (!containsLockedText(result.text, request)) {
      warnings.push("The exact locked-text check still failed. Review the output before approving it.");
    }
    if (research?.warnings.length) {
      warnings.push(...research.warnings);
    }

    return NextResponse.json({
      text: result.text,
      model: result.model,
      provider: result.provider,
      repaired,
      warnings,
      research,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
