import fs from "node:fs/promises";
import path from "node:path";
import type { AssistantSpecialty, KnowledgeCitation } from "./types";
type KnowledgeRecord = { id: string; title: string; source: string; text: string; tags?: string[]; specialty?: AssistantSpecialty | "all"; updatedAt?: string };
const DIR = process.env.TREY_KNOWLEDGE_DIR ? path.resolve(process.env.TREY_KNOWLEDGE_DIR) : path.join(process.cwd(), "knowledge", "private");
function tokens(value: string): string[] { return value.toLowerCase().replace(/[^a-z0-9'\s-]/g, " ").split(/\s+/).filter((token) => token.length > 2); }
async function walk(directory: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    return (await Promise.all(entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return walk(target);
      return entry.isFile() && entry.name.endsWith(".json") ? [target] : [];
    }))).flat();
  } catch { return []; }
}
async function load(): Promise<KnowledgeRecord[]> {
  const records: KnowledgeRecord[] = [];
  for (const file of await walk(DIR)) {
    try {
      const value = JSON.parse(await fs.readFile(file, "utf8")) as KnowledgeRecord | KnowledgeRecord[];
      records.push(...(Array.isArray(value) ? value : [value]));
    } catch {}
  }
  return records.filter((record) => record.id && record.title && record.source && record.text);
}
export async function retrieveKnowledge(query: string, specialty: AssistantSpecialty, limit = 8): Promise<{ context: string; citations: KnowledgeCitation[] }> {
  const queryTokens = new Set(tokens(query));
  const ranked = (await load()).filter((record) => !record.specialty || record.specialty === "all" || record.specialty === specialty).map((record) => {
    const score = tokens(`${record.title} ${record.tags?.join(" ") || ""} ${record.text}`).reduce((sum, token) => sum + (queryTokens.has(token) ? 1 : 0), 0) + tokens(record.title).reduce((sum, token) => sum + (queryTokens.has(token) ? 3 : 0), 0);
    return { record, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  const citations = ranked.map(({ record }, index) => ({ id: `K${index + 1}`, title: record.title, source: record.source, excerpt: record.text.slice(0, 420), updatedAt: record.updatedAt }));
  const context = ranked.map(({ record }, index) => `[K${index + 1}] ${record.title}\nSource: ${record.source}\nUpdated: ${record.updatedAt || "unknown"}\n${record.text}`).join("\n\n");
  return { context, citations };
}
export function getKnowledgeDirectory(): string { return DIR; }
