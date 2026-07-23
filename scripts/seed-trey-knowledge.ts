
import { saveVaultRecord, type VaultRecord } from "../src/lib/assistant/store";

const records: Array<Partial<VaultRecord> & Pick<VaultRecord, "id" | "kind" | "title" | "text" | "source">> = [
  {
    id: "profile-trey-trizzy-core",
    kind: "knowledge",
    title: "Trey Trizzy core artist identity",
    source: "Trey-approved operating context",
    specialty: "general",
    tags: ["Trey Trizzy", "artist identity", "brand"],
    status: "final",
    confidence: "confirmed",
    sensitivity: "private",
    text: "Trey Trizzy is a Memphis artist-founder, songwriter, visual storyteller, and creator-technology builder. His central artistic lane includes cinematic Trap R&B, dark melodic R&B, Southern emotional storytelling, Memphis edge, masculinity and vulnerability, transformation, ambition, emotional confidence, premium visual presentation, Southern Reclamation, The Human Standard, and Utility Music."
  },
  {
    id: "profile-trace-core",
    kind: "knowledge",
    title: "TRACE group identity",
    source: "Trey-approved TRACE operating context",
    specialty: "inside-ar",
    tags: ["TRACE", "Ace", "Trey", "Ced", "group"],
    status: "final",
    confidence: "confirmed",
    sensitivity: "private",
    text: "TRACE is a three-member Black R&B group. Ace is normally positioned on the left and functions as the charismatic energy and performance member. Trey is positioned in the center with long dreadlocks and serves as the human artist-founder and emotional anchor without automatically dominating every song. Ced is normaly positioned on the right with braids and functions as the calm harmony anchor. Ace and Ced are virtual artists or fictional performers and must be disclosed transparently when relevant."
  },
  {
    id: "rule-brand-separation",
    kind: "decision",
    title: "Trey solo and TRACE brand separation",
    source: "Trey-approved Inside A&R operating system",
    specialty: "inside-ar",
    tags: ["brand separation", "Trey solo", "TRACE"],
    status: "final",
    confidence: "confirmed",
    sensitivity: "private",
    text: "Every concept must be evaluated as Trey Trizzy solo, TRACE, both through a planned crossover, or neither. TRACE must not become a dumping ground for songs below Trey's solo standard. TRACE must not dilute Trey's solo identity, and Trey must not prevent Ace and Ced from becoming recognizable members."
  },
  {
    id: "rule-lyrics-protection",
    kind: "decision",
    title: "Protect approved lyrics",
    source: "Trey-approved songwriting rule",
    specialty: "songwriting",
    tags: ["lyrics", "approval", "version control"],
    status: "final",
    confidence: "confirmed",
    sensitivity: "private",
    text: "Do not rewrite, restructure, remove, or replace Trey Trizzy's lyrics unless he explicitly requests it. During feedback-only consultations, diagnose the issue, identify the exact section, explain its effect, and recommend the type of revision without silently rewriting the song."
  },
  {
    id: "rule-current-status-verification",
    kind: "decision",
    title: "Verify release status before strategy",
    source: "Trey-approved Inside A&R operating system",
    specialty: "catalog",
    tags: ["release status", "verification", "catalog"],
    status: "final",
    confidence: "confirmed",
    sensitivity: "private",
    text: "Never describe a previously released song as upcoming. Verify release status before campaign recommendations. When public pages conflict, report the contradiction and do not choose whichever version supports the recommendation."
  },
  {
    id: "preference-suno-prompts",
    kind: "memory",
    title: "Suno prompt requirements",
    source: "Trey working preference",
    specialty: "songwriting",
    tags: ["Suno", "prompt", "music"],
    status: "active",
    confidence: "confirmed",
    sensitivity: "private",
    text: "Suno style prompts for Trey Trizzy must stay under 1,000 characters and must not use famous artist names."
  },
  {
    id: "preference-audio-instructions",
    kind: "memory",
    title: "Audio instruction level",
    source: "Trey working preference",
    specialty: "general",
    tags: ["mixing", "mastering", "instructions"],
    status: "active",
    confidence: "confirmed",
    sensitivity: "private",
    text: "When explaining audio mixing or mastering, give beginner-level steps with an exact order and concrete values whenever the available tools support them."
  }
];

async function main() {
  let saved = 0;
  for (const record of records) {
    await saveVaultRecord(record);
    saved += 1;
  }
  console.log("Seeded " + saved + " Trey AI knowledge records.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
