import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function requireMarker(content, marker, label) {
  if (!content.includes(marker)) {
    throw new Error(`Missing ${label}: ${marker}`);
  }
}

const types = read("src/lib/types.ts");
const modes = read("src/lib/modes.ts");
const operatingSystem = read("src/lib/ar-operating-system.ts");
const research = read("src/lib/research.ts");
const prompt = read("src/lib/prompt.ts");
const route = read("src/app/api/generate/route.ts");
const page = read("src/app/page.tsx");
const lightning = read("scripts/lightning-start.sh");

requireMarker(types, '"inside-ar"', "Inside A&R mode id");
requireMarker(types, '"first-run-assignment"', "first-run focus id");
requireMarker(modes, "AR_CONSULTATION_FOCUSES", "A&R consultation focus registry");
requireMarker(operatingSystem, "PRIVATE INSIDE A&R OPERATING SYSTEM", "A&R operating system");
requireMarker(operatingSystem, "TRACE GROUP PROTOCOL", "TRACE group development rules");
requireMarker(operatingSystem, "LIVE RESEARCH STANDARD", "live research evidence rules");
requireMarker(research, "buildCurrentResearchPacket", "research packet builder");
requireMarker(research, "html.duckduckgo.com", "public web search provider");
requireMarker(research, "news.google.com/rss", "current news provider");
requireMarker(prompt, "buildInsideArSystemPrompt", "A&R prompt routing");
requireMarker(route, "buildCurrentResearchPacket", "A&R route research integration");
requireMarker(route, "research,", "research response payload");
requireMarker(page, "Consult Inside A&R", "A&R consultation action");
requireMarker(page, "Current intelligence", "research source interface");
requireMarker(page, "Executive consultation feedback", "A&R feedback training interface");
requireMarker(lightning, 'TRIZZY_LLAMA_CONTEXT:-8192', "Lightning 8K context window");

console.log("Inside A&R operating system regression check passed.");
