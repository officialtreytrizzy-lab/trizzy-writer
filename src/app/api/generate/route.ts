import { NextResponse } from "next/server";
import { z } from "zod";
import { generateWithModel } from "@/lib/model";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompt";
import { MODE_IDS, type GenerateRequest, type GenerateResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  mode: z.enum(MODE_IDS),
  prompt: z.string().trim().min(1).max(12000),
  sourceLyrics: z.string().max(30000).default(""),
  lockedLyrics: z.string().max(15000).default(""),
  maxCharacters: z.number().int().min(300).max(12000),
  creativity: z.number().min(0).max(1.2),
});

function containsLockedText(text: string, lockedLyrics: string): boolean {
  const locked = lockedLyrics.trim();
  return !locked || text.includes(locked);
}

async function repairDraft(
  request: GenerateRequest,
  draft: string,
  problems: string[],
): Promise<{ text: string; model: string; provider: string }> {
  const repairPrompt = [
    "Repair the draft below.",
    ...problems.map((problem) => `- ${problem}`),
    `- Keep the final response at or below ${request.maxCharacters} characters.`,
    "- Return only the repaired final writing.",
    request.lockedLyrics.trim()
      ? `- Include this locked block exactly:\n${request.lockedLyrics.trim()}`
      : "",
    `DRAFT TO REPAIR\n${draft}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return generateWithModel(
    [
      { role: "system", content: buildSystemPrompt(request) },
      { role: "user", content: repairPrompt },
    ],
    Math.max(0.2, request.creativity - 0.2),
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

    const request = parsed.data;
    let result = await generateWithModel(
      [
        { role: "system", content: buildSystemPrompt(request) },
        { role: "user", content: buildUserPrompt(request) },
      ],
      request.creativity,
      requestObject.signal,
    );

    const repairProblems: string[] = [];
    if (result.text.length > request.maxCharacters) {
      repairProblems.push(
        `Reduce the draft from ${result.text.length} characters to no more than ${request.maxCharacters}.`,
      );
    }
    if (!containsLockedText(result.text, request.lockedLyrics)) {
      repairProblems.push("The locked lyrics were changed, omitted, or separated. Restore the exact block.");
    }

    let repaired = false;
    if (repairProblems.length > 0) {
      result = await repairDraft(request, result.text, repairProblems);
      repaired = true;
    }

    const warnings: string[] = [];
    if (result.text.length > request.maxCharacters) {
      warnings.push(
        `The response remains ${result.text.length - request.maxCharacters} characters over the limit.`,
      );
    }
    if (!containsLockedText(result.text, request.lockedLyrics)) {
      warnings.push("The exact locked-text check still failed. Review the output before approving it.");
    }

    return NextResponse.json({
      text: result.text,
      model: result.model,
      provider: result.provider,
      repaired,
      warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
