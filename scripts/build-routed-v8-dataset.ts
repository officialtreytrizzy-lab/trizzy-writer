import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import operatingPrompts from "../src/lib/assistant/operating-prompts.json";

type Specialty = "songwriting" | "inside-ar" | "catalog" | "coding" | "general";
type Message = { role: "system" | "user" | "assistant"; content: string };
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
const V7_TRAIN = path.join(OUTPUT, "routed-v7-train.jsonl");
const V7_EVAL = path.join(OUTPUT, "routed-v7-eval.jsonl");
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
]);

const CORRECTIVE_GROUPS: Group[] = [
  {
    id: "v8-protect-lyrics-direct",
    specialty: "songwriting",
    principle: "Feedback-only lyric analysis explicitly keeps every supplied word exactly as written and never drifts into unrelated A&R advice.",
    prompts: [
      "Give feedback on this locked hook only; do not change any words.",
      "Keep my hook exactly as written and tell me what lands emotionally.",
      "Analyze these approved lyrics without rewriting or replacing a line.",
      "The wording is final. Give cadence and performance notes only.",
      "Preserve every word and explain the strongest phrase and main weakness.",
      "Feedback only on the locked lyric; no alternate bars or revised hook.",
    ],
    answer:
      "I will keep the lyrics exactly as written and give feedback only, without rewriting or replacing any line. The repeated question is memorable because it turns the conflict into one clear demand. The main development need is performance escalation: vary the pause, melody, intensity, and harmony around each repetition so the emotion grows while every approved word remains intact.",
  },
  {
    id: "v8-protect-lyrics-diagnosis",
    specialty: "songwriting",
    principle: "Protected lyrics receive specific craft diagnosis while the wording stays intact.",
    prompts: [
      "These bars are locked. Diagnose the repetition without editing them.",
      "Tell me whether this hook is catchy while leaving the lyric untouched.",
      "No rewrite: analyze the emotional clarity and singability of this chorus.",
      "Keep the exact wording and tell me where the delivery should build.",
      "Review my final lyric version without offering replacement language.",
      "What is the right response when I request notes but prohibit lyric changes?",
    ],
    answer:
      "The lyric stays intact. I will not provide replacement bars. I will identify what is working in the exact wording, where repetition strengthens or weakens the hook, how the syllables sit against the beat, and which delivery choices can create more lift. Any suggested improvement will concern melody, arrangement, dynamics, or performance unless Trey explicitly authorizes a rewrite.",
  },
  {
    id: "v8-release-verify-first",
    specialty: "catalog",
    principle: "Release planning never asserts status before verification and explicitly checks whether the record is released.",
    prompts: [
      "I am unsure whether this single already came out. Plan the next move safely.",
      "Before calling this record upcoming, what must you confirm?",
      "The release calendar and my memory conflict. How should you classify it?",
      "Do not assume the song is unreleased. Give the verification sequence.",
      "I need a rollout, but its current release status is uncertain.",
      "What should Trey AI say when asked to promote a record whose status is unknown?",
    ],
    answer:
      "The status is unverified, so I will not call the record upcoming or unreleased yet. First verify whether it is released by checking the distributor delivery record, DSP artist pages, the internal release calendar, and the catalog vault. Then classify it as unreleased, scheduled, released, or catalog. Only after that classification should the campaign be chosen.",
  },
  {
    id: "v8-release-classification",
    specialty: "catalog",
    principle: "Catalog advice explicitly separates unreleased, scheduled, released, and catalog campaigns after verification.",
    prompts: [
      "Explain how the campaign changes after you verify the song's status.",
      "How do you handle a song that might already be released?",
      "Give me the four release classifications and the correct campaign for each.",
      "Verify first, then explain pre-release versus catalog reactivation.",
      "What evidence prevents you from falsely calling a released song upcoming?",
      "Build the decision tree for an uncertain distributor and DSP status.",
    ],
    answer:
      "Verify the distributor, DSP pages, internal calendar, and catalog vault first. If the record is unreleased, finish development before scheduling. If it is scheduled, run a dated pre-release campaign. If it is released, treat it as live and optimize current discovery. If it is older catalog, use reactivation content. Never describe a released record as upcoming.",
  },
  {
    id: "v8-audio-chain-core",
    specialty: "general",
    principle: "A beginner vocal chain uses a technically valid numbered order with realistic compressor and de-esser values.",
    prompts: [
      "Give me the exact beginner chain for a dark Trap R&B lead vocal.",
      "List the vocal plugins in order with safe starting values.",
      "Build a numbered chain from clip gain through ambience for my baritone lead.",
      "I need a technically correct compressor and de-esser setup in the chain.",
      "Explain the basic lead-vocal signal flow for a new mixer.",
      "Give me practical starting numbers and a fair bypass comparison.",
    ],
    answer:
      "1) Set clip gain so vocal peaks sit around -12 to -6 dBFS without clipping. 2) Use cleanup or a gentle gate only if noise is audible. 3) High-pass EQ near 70-90 Hz and, if muddy, cut 1-3 dB around 200-350 Hz. 4) Set the compressor near 3:1, attack 20-30 ms, release 60-100 ms, and lower the threshold until gain reduction averages 3-6 dB. 5) Place a de-esser around the harsh 5-8 kHz area for about 2-5 dB reduction. 6) Add small tonal EQ moves only if needed. 7) Add light saturation. 8) Put short reverb and tempo delay on sends. 9) Level-match bypass and processed versions before deciding.",
  },
  {
    id: "v8-audio-chain-listening",
    specialty: "general",
    principle: "Audio guidance explains what to hear and how to adjust the compressor and de-esser safely.",
    prompts: [
      "What should I listen for while setting compression and de-essing?",
      "My vocal became flat and lispy. Correct the chain with exact adjustments.",
      "Explain how a beginner should tune compressor attack, release, and threshold.",
      "How do I stop a de-esser from dulling the singer?",
      "Give adjustment logic for a vocal that is muddy, harsh, and over-compressed.",
      "Walk me through a level-matched A/B of the vocal chain.",
    ],
    answer:
      "Use the compressor to control level without erasing the vocal's punch: start near 3:1, 20-30 ms attack, 60-100 ms release, and 3-6 dB gain reduction. If it sounds flat, raise the threshold, lower the ratio, or slow the attack. Set the de-esser in the actual harsh S range, usually 5-8 kHz, for 2-5 dB reduction. If the singer lisps or loses air, reduce the range or amount. Match output loudness to bypass and choose the clearer version, not merely the louder one.",
  },
  {
    id: "v8-audio-chain-effects",
    specialty: "general",
    principle: "Time effects and saturation follow corrective control and remain on controlled sends.",
    prompts: [
      "Where do saturation, reverb, and delay belong in a beginner vocal workflow?",
      "Give me the complete vocal order including effects sends.",
      "How should I add ambience without washing out a dark lead vocal?",
      "Build the chain and explain why reverb and delay are not inserted first.",
      "What is a safe starting point for plate reverb and tempo delay sends?",
      "Give me an ordered chain that keeps the vocal present over heavy 808s.",
    ],
    answer:
      "1) Clip gain. 2) Cleanup if necessary. 3) Corrective EQ. 4) Compressor at roughly 3:1 with 3-6 dB gain reduction. 5) De-esser for about 2-5 dB in the harsh S range. 6) Small tonal EQ. 7) Light saturation. 8) Send to a short plate reverb and filtered tempo delay, starting low enough that the words remain forward. Carve competing instrumental frequencies rather than over-brightening the vocal, then level-match and A/B the entire chain.",
  },
  {
    id: "v8-audio-chain-guardrails",
    specialty: "general",
    principle: "Beginner audio instructions avoid impossible gain-reduction values, repeated steps, and unrelated drum processing.",
    prompts: [
      "Give me vocal-chain guardrails so I do not over-process the lead.",
      "What values would be obviously wrong for a beginner vocal compressor?",
      "Keep the instructions focused on the lead vocal rather than drums or bass.",
      "Show a concise vocal chain with no duplicated steps.",
      "Correct a chain that suggests 60 dB of compression and repeated gain boosts.",
      "Give realistic starting values and tell me when to back off processing.",
    ],
    answer:
      "Keep the chain focused and realistic: 1) clip gain to healthy peaks, 2) corrective EQ, 3) compressor around 3:1 for 3-6 dB gain reduction, 4) de-esser for 2-5 dB, 5) optional tonal EQ, 6) light saturation, and 7) reverb or delay sends. Sixty dB of compressor reduction is unusable, and repeated random gain boosts are not a signal chain. Back off whenever clarity, consonants, dynamics, or emotion become worse, and confirm with a level-matched A/B.",
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
  assert(CORRECTIVE_GROUPS.length === 8, `Expected 8 corrective groups, found ${CORRECTIVE_GROUPS.length}.`);

  const v7Rows = [...(await readJsonl(V7_TRAIN)), ...(await readJsonl(V7_EVAL))];
  const replay = v7Rows.filter((row) => REPLAY_GROUPS.has(groupId(row)));
  assert(replay.length === 60, `Expected 60 replay rows, found ${replay.length}.`);

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
          source: "Trey AI routed remediation v8",
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
    purpose: "Low-learning-rate continuation from Revision 7 targeting protected lyrics, release verification, and technically valid beginner vocal chains while replaying passing behaviors.",
  };

  if (!CHECK_ONLY) {
    await fs.mkdir(OUTPUT, { recursive: true });
    await fs.writeFile(path.join(OUTPUT, "routed-v8-train.jsonl"), train.map((row) => JSON.stringify(row)).join("\n") + "\n");
    await fs.writeFile(path.join(OUTPUT, "routed-v8-eval.jsonl"), evaluation.map((row) => JSON.stringify(row)).join("\n") + "\n");
    await fs.writeFile(path.join(OUTPUT, "routed-v8-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  }
  console.log(JSON.stringify({ ok: true, checkOnly: CHECK_ONLY, ...manifest }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
