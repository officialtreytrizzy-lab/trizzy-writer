import { INSIDE_AR_OPERATING_SYSTEM } from "@/lib/ar-operating-system";
import operatingPrompts from "./operating-prompts.json";
import type { AssistantSpecialty } from "./types";

const SHARED = operatingPrompts.shared;
const SPECIALTY_BASE = operatingPrompts.specialties satisfies Record<AssistantSpecialty, string>;
const SPECIALTY: Record<AssistantSpecialty, string> = {
  ...SPECIALTY_BASE,
  "inside-ar": `${SPECIALTY_BASE["inside-ar"]}

${INSIDE_AR_OPERATING_SYSTEM}`,
};

export function buildUnifiedAssistantPrompt(specialty: AssistantSpecialty, knowledge: string): string {
  return `${SHARED}

ACTIVE SPECIALTY: ${specialty}
${SPECIALTY[specialty]}

PRIVATE KNOWLEDGE
${knowledge || "No directly relevant private knowledge was retrieved."}

When relying on private knowledge, cite its [K#] identifier.`;
}
