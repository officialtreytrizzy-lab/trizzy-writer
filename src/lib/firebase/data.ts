"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ensureFirebaseUser, getFirebaseServices } from "./client";
import type { DecisionRecord } from "../types";

export async function saveDecisionToFirebase(
  decision: DecisionRecord,
): Promise<"firebase" | "local-only"> {
  const services = getFirebaseServices();
  if (!services) return "local-only";

  const user = await ensureFirebaseUser();
  if (!user) return "local-only";

  await addDoc(collection(services.db, "users", user.uid, "decisions"), {
    ...decision,
    createdAt: serverTimestamp(),
    clientCreatedAt: decision.createdAt,
  });

  return "firebase";
}
