import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { AssistantSpecialty } from "./types";

export type VaultRecord = {
  id: string;
  kind: "knowledge" | "memory" | "decision" | "conversation";
  title: string;
  text: string;
  source: string;
  specialty?: AssistantSpecialty | "all";
  tags?: string[];
  status?: "active" | "final" | "superseded" | "draft";
  confidence?: "confirmed" | "inferred" | "unverified";
  sensitivity?: "private" | "confidential" | "highly-confidential";
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
};
const ROOT = process.env.TREY_KNOWLEDGE_DIR ? path.resolve(process.env.TREY_KNOWLEDGE_DIR) : path.join(process.cwd(), "knowledge", "private");
const STORE_FILE = path.join(ROOT, "vault.records.json");
async function ensureStore(){await fs.mkdir(ROOT,{recursive:true});try{await fs.access(STORE_FILE);}catch{await fs.writeFile(STORE_FILE,"[]\n","utf8");}}
async function readAll():Promise<VaultRecord[]>{await ensureStore();try{const parsed=JSON.parse(await fs.readFile(STORE_FILE,"utf8")) as VaultRecord[];return Array.isArray(parsed)?parsed:[];}catch{return[];}}
async function writeAll(records:VaultRecord[]){await ensureStore();const temp=`${STORE_FILE}.${process.pid}.tmp`;await fs.writeFile(temp,JSON.stringify(records,null,2)+"\n","utf8");await fs.rename(temp,STORE_FILE);}
export async function listVaultRecords(kind?:VaultRecord["kind"]){const records=await readAll();return records.filter(r=>!kind||r.kind===kind).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
export async function saveVaultRecord(input:Partial<VaultRecord>&Pick<VaultRecord,"kind"|"title"|"text"|"source">):Promise<VaultRecord>{const records=await readAll();const now=new Date().toISOString();const id=input.id||`${input.kind}-${crypto.randomUUID()}`;const index=records.findIndex(r=>r.id===id);const record:VaultRecord={id,kind:input.kind,title:input.title.trim(),text:input.text.trim(),source:input.source.trim(),specialty:input.specialty||"all",tags:input.tags||[],status:input.status||"active",confidence:input.confidence||"confirmed",sensitivity:input.sensitivity||"private",createdAt:index>=0?records[index].createdAt:now,updatedAt:now,metadata:input.metadata||{}};if(index>=0)records[index]=record;else records.push(record);await writeAll(records);return record;}
export async function deleteVaultRecord(id:string){const records=await readAll();const next=records.filter(r=>r.id!==id);if(next.length===records.length)return false;await writeAll(next);return true;}
export function getVaultDirectory(){return ROOT;}