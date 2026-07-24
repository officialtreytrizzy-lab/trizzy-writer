import fs from "node:fs";
import path from "node:path";
import operatingPrompts from "../src/lib/assistant/operating-prompts.json";
import evalCases from "../training/eval_cases.json";
import { buildUnifiedAssistantPrompt } from "../src/lib/assistant/prompt";
import { ASSISTANT_SPECIALTIES, type AssistantSpecialty } from "../src/lib/assistant/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const specialties = operatingPrompts.specialties as Record<string, string>;
assert(evalCases.systemPrompt === operatingPrompts.shared, "Shared system prompt drift detected between eval_cases.json and operating-prompts.json.");
assert(Object.keys(specialties).sort().join("|") === [...ASSISTANT_SPECIALTIES].sort().join("|"), "Canonical specialty keys do not match AssistantSpecialty.");

for (const specialty of ASSISTANT_SPECIALTIES) {
  const value = specialties[specialty];
  assert(typeof value === "string" && value.length >= 120, `${specialty} canonical prompt is missing or too short.`);
  const runtimePrompt = buildUnifiedAssistantPrompt(specialty as AssistantSpecialty, "");
  assert(runtimePrompt.includes(`ACTIVE SPECIALTY: ${specialty}`), `${specialty} runtime prompt is missing the routed specialty label.`);
  assert(runtimePrompt.includes(value), `${specialty} runtime prompt does not include the canonical specialty overlay.`);
}

const songwriting = specialties.songwriting.toLowerCase();
assert(songwriting.includes("exactly as written"), "Songwriting prompt must require explicit protected-lyric preservation language.");
assert(songwriting.includes("without rewriting"), "Songwriting prompt must prohibit rewriting during feedback-only requests.");

const catalog = specialties.catalog.toLowerCase();
assert(catalog.includes("status is unverified"), "Catalog prompt must explicitly label uncertain status as unverified.");
assert(catalog.includes("verify whether the record is released"), "Catalog prompt must require release verification before campaign advice.");
assert(catalog.includes("never assert"), "Catalog prompt must prohibit unsupported release-status assertions.");

const consumers = [
  "src/lib/assistant/prompt.ts",
  "scripts/build-routed-v7-dataset.ts",
  "scripts/build-routed-v8-dataset.ts",
  "scripts/build-routed-v9-dataset.ts",
  "training/evaluate_adapter.py",
];
for (const relative of consumers) {
  const text = fs.readFileSync(path.join(process.cwd(), relative), "utf8");
  assert(text.includes("operating-prompts.json"), `${relative} is not wired to the canonical operating prompts.`);
}

console.log("Unified operating prompt alignment checks passed.");