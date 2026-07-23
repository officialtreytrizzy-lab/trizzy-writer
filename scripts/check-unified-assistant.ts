import { routeAssistantRequest } from "../src/lib/assistant/router";
const cases = [
  ["Write me a song about being overlooked", "songwriting"],
  ["What should my next premiere and rollout look like?", "inside-ar"],
  ["Which song in my catalog is similar to this?", "catalog"],
  ["Fix the TypeScript build in my repo", "coding"],
  ["Help me plan my day", "general"],
] as const;
for (const [input, expected] of cases) {
  const actual = routeAssistantRequest(input);
  if (actual !== expected) throw new Error(`${input}: expected ${expected}, got ${actual}`);
}
console.log("Unified assistant routing checks passed.");
