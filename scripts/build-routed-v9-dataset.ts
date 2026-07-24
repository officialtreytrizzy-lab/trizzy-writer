import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import operatingPrompts from "../src/lib/assistant/operating-prompts.json";

type Specialty = "songwriting" | "inside-ar" | "catalog" | "coding" | "general";
type Row = {
  id: string;
  specialty: Specialty;
  principle: string;
  prompt: Array<{ role: "system" | "user"; content: string }>;
  completion: Array<{ role: "assistant"; content: string }>;
  metadata: Record<string, unknown>;
};
type Group = { id: string; specialty: Specialty; principle: string; prompts: string[]; answer: string };

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, "training", "data");
const EVAL_CASES = path.join(ROOT, "training", "eval_cases.json");
const V8_TRAIN = path.join(OUTPUT, "routed-v8-train.jsonl");
const V8_EVAL = path.join(OUTPUT, "routed-v8-eval.jsonl");
const CHECK_ONLY = process.argv.includes("--check");

const SPECIALTY_PROMPTS = operatingPrompts.specialties satisfies Record<Specialty, string>;

const REPLAY_GROUPS = new Set([
  "v7-dirty-repo-status",
  "v7-dirty-repo-verification",
  "v7-anchor-suno",
  "v7-anchor-ar",
  "v7-anchor-deployment",
  "v7-anchor-no-fabrication",
  "v7-anchor-tremix",
  "v7-anchor-trace",
  "v7-anchor-retrieval",
  "v7-anchor-cost",
  "v8-audio-chain-core",
  "v8-audio-chain-listening",
  "v8-audio-chain-effects",
  "v8-audio-chain-guardrails",
]);

const CORRECTIVE_GROUPS: Group[] = [
  {
    id: "v9-protect-lyrics-explicit",
    specialty: "songwriting",
    principle: "Feedback-only lyric requests begin with explicit preservation language and never rewrite the supplied words.",
    prompts: [
      "Feedback only. Keep these lyrics exactly as written and tell me what works and what needs development.",
      "Keep my hook intact and give notes without rewriting it.",
      "These lyrics are locked. Analyze them exactly as written.",
      "Give feedback on the approved words only; no replacement lines.",
      "Do not revise the lyric. Tell me what lands emotionally and what needs development.",
      "What should you say first when I request lyric feedback but prohibit rewriting?",
    ],
    answer:
      "I will keep the lyrics exactly as written and give feedback only, without rewriting or replacing any line. I will identify the strongest emotional phrase, any cadence or clarity issue, where repetition helps or weakens the hook, and what melody, delivery, harmony, dynamics, or arrangement can develop the section while every approved word remains intact.",
  },
  {
    id: "v9-protect-lyrics-specific",
    specialty: "songwriting",
    principle: "Protected lyric feedback remains specific to the supplied craft rather than becoming generic strategy advice.",
    prompts: [
      "Analyze this locked hook without rewriting: Can you keep it real? Is it hard just keeping it real?",
      "Keep every word and explain whether the repetition is effective.",
      "Give cadence and delivery notes on my final hook without changing it.",
      "The wording stays intact. Diagnose singability and emotional escalation.",
      "No new bars. Tell me the strongest anchor and the main development need.",
      "Review the exact lyric and recommend performance changes only.",
    ],
    answer:
      "I will keep the hook intact and analyze it without rewriting. The repeated question is the strongest anchor because it makes the conflict immediate and memorable. The development need is escalation: vary the pause, melody, intensity, harmony, and surrounding instrumentation so each repetition carries more pressure while the exact lyric remains unchanged.",
  },
  {
    id: "v9-release-unverified",
    specialty: "catalog",
    principle: "An uncertain release is explicitly labeled unverified and never assigned a status before evidence is checked.",
    prompts: [
      "Plan the upcoming rollout for Night Signal. I am not sure whether it already released.",
      "I cannot remember whether this single is already live. What comes first?",
      "Do not assume the record is unreleased; verify its status before planning.",
      "The release date is uncertain. Build the safe next step.",
      "My memory and release calendar conflict. How do you respond?",
      "What exact language should you use when the release status is unknown?",
    ],
    answer:
      "The release status is unverified. I need to verify whether the record is released before planning any rollout, so I will not call it upcoming, unreleased, or not yet released. Check the distributor delivery record, DSP artist pages, internal release calendar, and catalog vault; then classify it as unreleased, scheduled, released, or catalog and choose the matching campaign.",
  },
  {
    id: "v9-release-evidence",
    specialty: "catalog",
    principle: "Release verification uses explicit evidence and converts the result into the correct campaign classification.",
    prompts: [
      "Verify first, then explain how the campaign changes if the song is already released.",
      "What evidence confirms whether a record is released?",
      "Give the classification sequence for an uncertain song status.",
      "How do you avoid falsely calling a live record upcoming?",
      "The distributor and DSP pages may disagree. What should Trey AI do?",
      "Build the release-status decision tree without inventing facts.",
    ],
    answer:
      "First verify whether the record is released using the distributor delivery record, DSP artist pages, the internal release calendar, and the catalog vault. Until those sources are checked, the status remains unverified. After verification, classify it as unreleased, scheduled, released, or catalog. Use development for unreleased, a dated pre-release rollout for scheduled, live optimization for released, and reactivation for catalog.",
  },
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
async function readJsonl(file: string): Promise<Row[]> {
  const text = await fs.readFile(file, "utf8");
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as Row);
}
function groupId(row: Row): string {
  return String(row.metadata.seedId ?? "");
}

async function main() {
  const evalText = await fs.readFile(EVAL_CASES, "utf8");
  const evalCases = JSON.parse(evalText) as { systemPrompt: string };
  assert(evalCases.systemPrompt.includes("NON-NEGOTIABLE OPERATING RULES"), "Evaluation prompt is missing operating rules.");
  assert(CORRECTIVE_GROUPS.length === 4, `Expected 4 corrective groups, found ${CORRECTIVE_GROUPS.length}.`);

  const v8Rows = [...(await readJsonl(V8_TRAIN)), ...(await readJsonl(V8_EVAL))];
  const replay = v8Rows.filter((row) => REPLAY_GROUPS.has(groupId(row)));
  assert(replay.length === 84, `Expected 84 replay rows, found ${replay.length}.`);

  const prompts = new Set(replay.map((row) => row.prompt.at(-1)?.content.trim().toLowerCase().replace(/\s+/g, " ") ?? ""));
  const corrective: Row[] = [];
  for (const group of CORRECTIVE_GROUPS) {
    assert(group.prompts.length === 6, `${group.id} must have six prompt variants.`);
    assert(group.answer.length >= 180, `${group.id} answer is too short.`);
    const routedSystem = `${operatingPrompts.shared}\n\nACTIVE SPECIALTY: ${group.specialty}\n${SPECIALTY_PROMPTS[group.specialty]}`;
    group.prompts.forEach((userPrompt, index) => {
      const normalized = userPrompt.trim().toLowerCase().replace(/\s+/g, " ");
      assert(!prompts.has(normalized), `Duplicate prompt: ${userPrompt}`);
      prompts.add(normalized);
      corrective.push({
        id: `${group.id}-${String(index + 1).padStart(2, "0")}`,
        specialty: group.specialty,
        principle: group.principle,
        prompt: [
          { role: "system", content: routedSystem },
          { role: "user", content: userPrompt.trim() },
        ],
        completion: [{ role: "assistant", content: group.answer.trim() }],
        metadata: {
          source: "Trey AI routed remediation v9",
          seedId: group.id,
          promptIndex: index,
          approved: true,
          routed: true,
        },
      });
    });
  }

  const all = [...replay, ...corrective];
  const evaluation = all.filter((row) => Number(row.metadata.promptIndex) === 5);
  const train = all.filter((row) => Number(row.metadata.promptIndex) !== 5);
  train.sort((a, b) => hash(a.id).localeCompare(hash(b.id)));
  evaluation.sort((a, b) => hash(a.id).localeCompare(hash(b.id)));
  assert(all.length === 108, `Expected 108 rows, found ${all.length}.`);
  assert(train.length === 90, `Expected 90 training rows, found ${train.length}.`);
  assert(evaluation.length === 18, `Expected 18 evaluation rows, found ${evaluation.length}.`);

  const manifest = {
    schemaVersion: 1,
    totalRows: all.length,
    trainRows: train.length,
    evalRows: evaluation.length,
    replayRows: replay.length,
    correctiveRows: corrective.length,
    correctiveGroups: CORRECTIVE_GROUPS.length,
    replayGroups: REPLAY_GROUPS.size,
    evalCasesSha256: hash(evalText),
    purpose: "Low-learning-rate continuation from Revision 8 targeting explicit protected-lyric preservation and evidence-first release verification while replaying all passing behaviors.",
  };

  if (!CHECK_ONLY) {
    await fs.mkdir(OUTPUT, { recursive: true });
    await fs.writeFile(path.join(OUTPUT, "routed-v9-train.jsonl"), train.map((row) => JSON.stringify(row)).join("\n") + "\n");
    await fs.writeFile(path.join(OUTPUT, "routed-v9-eval.jsonl"), evaluation.map((row) => JSON.stringify(row)).join("\n") + "\n");
    await fs.writeFile(path.join(OUTPUT, "routed-v9-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  }
  console.log(JSON.stringify({ ok: true, checkOnly: CHECK_ONLY, ...manifest }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});