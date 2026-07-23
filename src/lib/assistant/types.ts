export const ASSISTANT_SPECIALTIES = ["songwriting", "inside-ar", "catalog", "coding", "general"] as const;
export type AssistantSpecialty = (typeof ASSISTANT_SPECIALTIES)[number];
export type AssistantChatMessage = { role: "user" | "assistant"; content: string };
export type KnowledgeCitation = { id: string; title: string; source: string; excerpt: string; updatedAt?: string };
export type AssistantRequest = { message: string; history?: AssistantChatMessage[]; forceSpecialty?: AssistantSpecialty; liveResearch?: boolean };
export type AssistantResponse = { text: string; specialty: AssistantSpecialty; model: string; provider: string; citations: KnowledgeCitation[]; warnings: string[] };
