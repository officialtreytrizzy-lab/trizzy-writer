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
  metadata: { source: string; seedId: string; promptIndex: number; approved: true };
};

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "training", "remediation_examples.seed.json");
const OUTPUT = path.join(ROOT, "training", "data");
const CHECK_ONLY = process.argv.includes("--check");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function main() {
  const sourceText = await fs.readFile(SOURCE, "utf8");
  const seed = JSON.parse(sourceText) as SeedFile;
  assert(seed.version === 1, "Unsupported remediation seed version.");
  assert(seed.systemPrompt.includes("/no_think"), "Remediation system prompt must disable visible thinking.");
  assert(seed.examples.length >= 14, "At least 14 remediation examples are required.");

  const ids = new Set<string>();
  const prompts = new Set<string>();
  const rows: Row[] = [];
  for (const example of seed.examples) {
    assert(!ids.has(example.id), `Duplicate remediation id: ${example.id}`);
    ids.add(example.id);
    assert(example.prompts.length >= 6, `${example.id} needs at least six prompt variants.`);
    assert(example.answer.length >= 80, `${example.id} answer is too short.`);
    example.prompts.forEach((userPrompt, index) => {
      const normalized = userPrompt.trim().toLowerCase().replace(/\s+/g, " ");
      assert(!prompts.has(normalized), `Duplicate remediation prompt: ${userPrompt}`);
      prompts.add(normalized);
      rows.push({
        id: `${example.id}-${String(index + 1).padStart(2, "0")}`,
        specialty: example.specialty,
        principle: example.principle,
        prompt: [
          { role: "system", content: seed.systemPrompt },
          { role: "user", content: userPrompt.trim() },
        ],
        completion: [{ role: "assistant", content: example.answer.trim() }],
        metadata: {
          source: "Trey AI behavioral remediation",
          seedId: example.id,
          promptIndex: index,
          approved: true,
        },
      });
    });
  }

  const ranked = rows.sort((a, b) => hash(a.id).localeCompare(hash(b.id)));
  const evalIds = new Set(ranked.filter((_, index) => index % 7 === 0).map((row) => row.id));
  const evaluation = ranked.filter((row) => evalIds.has(row.id)).sort((a, b) => a.id.localeCompare(b.id));
  const train = ranked.filter((row) => !evalIds.has(row.id)).sort((a, b) => a.id.localeCompare(b.id));
  assert(train.length >= 70, `Remediation train split is too small: ${train.length}`);
  assert(evaluation.length >= 12, `Remediation eval split is too small: ${evaluation.length}`);

  const manifest = {
    schemaVersion: 1,
    source: "training/remediation_examples.seed.json",
    sourceSha256: hash(sourceText),
    totalRows: rows.length,
    trainRows: train.length,
    evalRows: evaluation.length,
    purpose: "Focused continued SFT for behaviors that failed revision-2 evaluation.",
  };

  if (!CHECK_ONLY) {
    await fs.mkdir(OUTPUT, { recursive: true });
    await fs.writeFile(path.join(OUTPUT, "remediation-train.jsonl"), train.map((row) => JSON.stringify(row)).join("\n") + "\n");
    await fs.writeFile(path.join(OUTPUT, "remediation-eval.jsonl"), evaluation.map((row) => JSON.stringify(row)).join("\n") + "\n");
    await fs.writeFile(path.join(OUTPUT, "remediation-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  }

  console.log(JSON.stringify({ ok: true, checkOnly: CHECK_ONLY, ...manifest }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
