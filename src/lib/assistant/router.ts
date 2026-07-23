import type { AssistantSpecialty } from "./types";
const RULES: Array<{ specialty: AssistantSpecialty; patterns: RegExp[] }> = [
  { specialty: "coding", patterns: [/\b(repo|repository|github|code|coding|typescript|javascript|react|next\.?js|firebase|supabase|vercel|api|endpoint|database|bug|error|build|deploy|function|component|route|commit|branch|pull request)\b/i] },
  { specialty: "catalog", patterns: [/\b(which song|what song|similar song|catalog|lyrics? did i|release date|released|upcoming|isrc|upc|split sheet|producer credit|writer credit|master|demo|version of)\b/i] },
  { specialty: "inside-ar", patterns: [/\b(a&r|single|premiere|rollout|release strategy|career|trace|ace|ced|market|audience|campaign|deal|label|distribution|publishing|sync|brand strategy|next release|should i release)\b/i] },
  { specialty: "songwriting", patterns: [/\b(write|rewrite|song|hook|chorus|verse|pre-?chorus|bridge|lyrics?|bar|rhyme|cadence|melody|suno|full song)\b/i] },
];
export function routeAssistantRequest(message: string): AssistantSpecialty {
  for (const rule of RULES) if (rule.patterns.some((pattern) => pattern.test(message))) return rule.specialty;
  return "general";
}
