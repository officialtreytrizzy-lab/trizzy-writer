import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

type Specialty = "songwriting" | "inside-ar" | "catalog" | "coding" | "general";

type SeedExample = {
  id: string;
  specialty: Specialty;
  principle: string;
  prompts: string[];
  answer: string;
};

type SeedFile = {
  version: number;
  systemPrompt: string;
  examples: SeedExample[];
};

type TrainingRow = {
  id: string;
  specialty: Specialty;
  principle: string;
  prompt: Array<{ role: "system" | "user"; content: string }>;
  completion: Array<{ role: "assistant"; content: string }>;
  metadata: {
    source: string;
    seedId: string;
    promptIndex: number;
    approved: true;
  };
};

const ROOT = process.cwd();
const SOURCE_PATHS = [
  path.join(ROOT, "training", "approved_examples.seed.json"),
  path.join(ROOT, "training", "applied_examples.seed.json"),
  path.join(ROOT, "training", "behavior_drills.seed.json"),
];
const OUTPUT_DIR = path.join(ROOT, "training", "data");
const TRAIN_PATH = path.join(OUTPUT_DIR, "train.jsonl");
const EVAL_PATH = path.join(OUTPUT_DIR, "eval.jsonl");
const MANIFEST_PATH = path.join(OUTPUT_DIR, "manifest.json");
const CHECK_ONLY = process.argv.includes("--check");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function stableHash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function validateSeed(seed: SeedFile) {
  assert(seed.version === 1, "Unsupported training seed version.");
  assert(typeof seed.systemPrompt === "string" && seed.systemPrompt.length >= 80, "System prompt is missing or too short.");
  assert(seed.systemPrompt.includes("/no_think"), "System prompt must disable visible Qwen thinking output with /no_think.");
  assert(Array.isArray(seed.examples) && seed.examples.length >= 20, "At least 20 approved seed examples are required.");

  const ids = new Set<string>();
  const prompts = new Set<string>();
  for (const example of seed.examples) {
    assert(/^[a-z0-9-]+$/.test(example.id), `Invalid seed id: ${example.id}`);
    assert(!ids.has(example.id), `Duplicate seed id: ${example.id}`);
    ids.add(example.id);
    assert(["songwriting", "inside-ar", "catalog", "coding", "general"].includes(example.specialty), `Invalid specialty for ${example.id}.`);
    assert(example.principle.trim().length >= 20, `Principle is too short for ${example.id}.`);
    assert(Array.isArray(example.prompts) && example.prompts.length >= 2, `At least two prompt variants are required for ${example.id}.`);
    assert(example.answer.trim().length >= 40, `Answer is too short for ${example.id}.`);

    for (const prompt of example.prompts) {
      const key = normalize(prompt);
      assert(prompt.trim().length >= 8, `Prompt is too short for ${example.id}.`);
      assert(!prompts.has(key), `Duplicate prompt detected: ${prompt}`);
      prompts.add(key);
    }
  }
}

function buildRows(seed: SeedFile): TrainingRow[] {
  const rows: TrainingRow[] = [];
  for (const example of seed.examples) {
    example.prompts.forEach((userPrompt, index) => {
      rows.push({
        id: `${example.id}-${String(index + 1).padStart(2, "0")}`,
        specialty: example.specialty,
        principle: example.principle.trim(),
        prompt: [
          { role: "system", content: seed.systemPrompt.trim() },
          { role: "user", content: userPrompt.trim() },
        ],
        completion: [{ role: "assistant", content: example.answer.trim() }],
        metadata: {
          source: "Trey-approved behavior seed",
          seedId: example.id,
          promptIndex: index,
          approved: true,
        },
      });
    });
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

function splitRows(rows: TrainingRow[]) {
  const bySpecialty = new Map<Specialty, TrainingRow[]>();
  for (const row of rows) {
    const bucket = bySpecialty.get(row.specialty) ?? [];
    bucket.push(row);
    bySpecialty.set(row.specialty, bucket);
  }

  const train: TrainingRow[] = [];
  const evaluation: TrainingRow[] = [];
  for (const [, bucket] of bySpecialty) {
    const ranked = [...bucket].sort((a, b) => stableHash(a.id).localeCompare(stableHash(b.id)));
    const evalCount = Math.max(1, Math.round(ranked.length * 0.15));
    evaluation.push(...ranked.slice(0, evalCount));
    train.push(...ranked.slice(evalCount));
  }

  return {
    train: train.sort((a, b) => a.id.localeCompare(b.id)),
    evaluation: evaluation.sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function countBySpecialty(rows: TrainingRow[]) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.specialty] = (counts[row.specialty] ?? 0) + 1;
    return counts;
  }, {});
}

async function readSeeds(): Promise<{ seed: SeedFile; sourceTexts: Array<{ file: string; text: string }> }> {
  const sourceTexts: Array<{ file: string; text: string }> = [];
  const examples: SeedExample[] = [];
  let systemPrompt = "";

  for (const sourcePath of SOURCE_PATHS) {
    const text = await fs.readFile(sourcePath, "utf8");
    const parsed = JSON.parse(text) as SeedFile;
    assert(parsed.version === 1, `Unsupported version in ${sourcePath}.`);
    assert(parsed.systemPrompt.trim().length >= 80, `System prompt is missing in ${sourcePath}.`);
    if (!systemPrompt) systemPrompt = parsed.systemPrompt.trim();
    assert(systemPrompt === parsed.systemPrompt.trim(), `System prompts do not match across seed files: ${sourcePath}`);
    examples.push(...parsed.examples);
    sourceTexts.push({ file: path.relative(ROOT, sourcePath).replaceAll("\\", "/"), text });
  }

  const seed: SeedFile = { version: 1, systemPrompt, examples };
  validateSeed(seed);
  return { seed, sourceTexts };
}

async function writeJsonl(filePath: string, rows: TrainingRow[]) {
  const body = rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
  await fs.writeFile(filePath, body, "utf8");
}

async function main() {
  const { seed, sourceTexts } = await readSeeds();
  const rows = buildRows(seed);
  const { train, evaluation } = splitRows(rows);

  assert(rows.length >= 95, `Training set is too small: ${rows.length} rows.`);
  assert(train.length > evaluation.length, "Training split must be larger than evaluation split.");

  const sourceFingerprint = sourceTexts.map(({ file, text }) => `${file}\n${text}`).join("\n---\n");
  const manifest = {
    schemaVersion: 1,
    sources: sourceTexts.map(({ file }) => file),
    sourceSha256: stableHash(sourceFingerprint),
    totalRows: rows.length,
    trainRows: train.length,
    evalRows: evaluation.length,
    trainBySpecialty: countBySpecialty(train),
    evalBySpecialty: countBySpecialty(evaluation),
    modelPurpose: "Stable Trey AI behavior and workflow discipline. Volatile facts remain in retrieval.",
  };

  if (!CHECK_ONLY) {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await writeJsonl(TRAIN_PATH, train);
    await writeJsonl(EVAL_PATH, evaluation);
    await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  }

  console.log(JSON.stringify({ ok: true, checkOnly: CHECK_ONLY, ...manifest }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
