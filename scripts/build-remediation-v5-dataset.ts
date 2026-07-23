import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

type Specialty = "songwriting" | "inside-ar" | "catalog" | "coding" | "general";
type SeedExample = { id: string; specialty: Specialty; principle: string; prompts: string[]; answer: string };
type SeedFile = { version: number; systemPrompt: string; examples: SeedExample[] };
type Row = {
  id: string;
  specialty: Specialty;
  principle: string;
  prompt: Array<{ role: "system" | "user"; content: string }>;
  completion: Array<{ role: "assistant"; content: string }>;
  metadata: { source: string; seedId: string; promptIndex: number; approved: true; priority: number };
};

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, "training", "data");
const CHECK_ONLY = process.argv.includes("--check");
const SOURCES = [
  "training/approved_examples.seed.json",
  "training/applied_examples.seed.json",
  "training/behavior_drills.seed.json",
  "training/remediation_examples.seed.json",
  "training/remediation_v4_examples.seed.json",
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

async function main() {
  const selected = new Map<string, Row>();
  const sourceHashes: Record<string, string> = {};
  let systemPrompt = "";
  let rawRows = 0;

  for (const [priority, relative] of SOURCES.entries()) {
    const sourcePath = path.join(ROOT, relative);
    const sourceText = await fs.readFile(sourcePath, "utf8");
    sourceHashes[relative] = hash(sourceText);
    const seed = JSON.parse(sourceText) as SeedFile;
    assert(seed.version === 1, `Unsupported seed version in ${relative}.`);
    assert(seed.systemPrompt.includes("/no_think"), `${relative} must disable visible thinking.`);
    if (!systemPrompt) systemPrompt = seed.systemPrompt;
    assert(seed.systemPrompt === systemPrompt, `${relative} has a conflicting system prompt.`);

    for (const example of seed.examples) {
      assert(example.prompts.length >= 2, `${relative}:${example.id} needs at least two prompts.`);
      assert(example.answer.trim().length >= 60, `${relative}:${example.id} answer is too short.`);
      example.prompts.forEach((userPrompt, promptIndex) => {
        rawRows += 1;
        const key = normalize(userPrompt);
        selected.set(key, {
          id: `${path.basename(relative, ".seed.json")}-${example.id}-${String(promptIndex + 1).padStart(2, "0")}`,
          specialty: example.specialty,
          principle: example.principle,
          prompt: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt.trim() },
          ],
          completion: [{ role: "assistant", content: example.answer.trim() }],
          metadata: {
            source: relative,
            seedId: example.id,
            promptIndex,
            approved: true,
            priority,
          },
        });
      });
    }
  }

  const rows = [...selected.values()].sort((a, b) => hash(a.id).localeCompare(hash(b.id)));
  const evalIds = new Set(rows.filter((_, index) => index % 9 === 0).map((row) => row.id));
  const evaluation = rows.filter((row) => evalIds.has(row.id)).sort((a, b) => a.id.localeCompare(b.id));
  const train = rows.filter((row) => !evalIds.has(row.id)).sort((a, b) => a.id.localeCompare(b.id));

  assert(train.length >= 250, `Revision-5 training split is too small: ${train.length}`);
  assert(evaluation.length >= 30, `Revision-5 evaluation split is too small: ${evaluation.length}`);

  const trainSpecialties = train.reduce<Record<string, number>>((counts, row) => {
    counts[row.specialty] = (counts[row.specialty] ?? 0) + 1;
    return counts;
  }, {});
  const evalSpecialties = evaluation.reduce<Record<string, number>>((counts, row) => {
    counts[row.specialty] = (counts[row.specialty] ?? 0) + 1;
    return counts;
  }, {});

  const manifest = {
    schemaVersion: 1,
    sources: SOURCES,
    sourceSha256: sourceHashes,
    rawRows,
    uniqueRows: rows.length,
    supersededDuplicatePrompts: rawRows - rows.length,
    trainRows: train.length,
    evalRows: evaluation.length,
    trainBySpecialty: trainSpecialties,
    evalBySpecialty: evalSpecialties,
    purpose: "Replay-balanced continued SFT from revision 3 across all approved Trey AI behaviors.",
  };

  if (!CHECK_ONLY) {
    await fs.mkdir(OUTPUT, { recursive: true });
    await fs.writeFile(path.join(OUTPUT, "remediation-v5-train.jsonl"), train.map((row) => JSON.stringify(row)).join("\n") + "\n");
    await fs.writeFile(path.join(OUTPUT, "remediation-v5-eval.jsonl"), evaluation.map((row) => JSON.stringify(row)).join("\n") + "\n");
    await fs.writeFile(path.join(OUTPUT, "remediation-v5-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  }

  console.log(JSON.stringify({ ok: true, checkOnly: CHECK_ONLY, ...manifest }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
