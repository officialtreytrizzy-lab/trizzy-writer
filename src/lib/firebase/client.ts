"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type Unsubscribe,
  type User,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};

let services: FirebaseServices | null = null;

export function getFirebaseServices(): FirebaseServices | null {
  if (!isFirebaseConfigured) return null;
  if (services) return services;

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  services = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
  };
  return services;
}

export function observeFirebaseUser(callback: (user: User | null) => void): Unsubscribe {
  const current = getFirebaseServices();
  if (!current) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(current.auth, callback);
}

export async function ensureFirebaseUser(): Promise<User | null> {
  const current = getFirebaseServices();
  if (!current) return null;
  if (current.auth.currentUser) return current.auth.currentUser;

  const credential = await signInAnonymously(current.auth);
  return credential.user;
}

export async function signInAsGuest(): Promise<User> {
  const current = getFirebaseServices();
  if (!current) throw new Error("Firebase is not configured.");
  const credential = await signInAnonymously(current.auth);
  return credential.user;
}

export async function signInWithGoogle(): Promise<User> {
  const current = getFirebaseServices();
  if (!current) throw new Error("Firebase is not configured.");

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const activeUser = current.auth.currentUser;

  if (activeUser?.isAnonymous) {
    try {
      const linked = await linkWithPopup(activeUser, provider);
      return linked.user;
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (!code.includes("credential-already-in-use") && !code.includes("email-already-in-use")) {
        throw error;
      }
      await signOut(current.auth);
    }
  }

  const credential = await signInWithPopup(current.auth, provider);
  return credential.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const current = getFirebaseServices();
  if (!current) throw new Error("Firebase is not configured.");
  const credential = await signInWithEmailAndPassword(current.auth, email.trim(), password);
  return credential.user;
}

export async function createEmailAccount(email: string, password: string): Promise<User> {
  const current = getFirebaseServices();
  if (!current) throw new Error("Firebase is not configured.");

  const normalizedEmail = email.trim();
  const activeUser = current.auth.currentUser;
  if (activeUser?.isAnonymous) {
    const credential = EmailAuthProvider.credential(normalizedEmail, password);
    const linked = await linkWithCredential(activeUser, credential);
    return linked.user;
  }

  const created = await createUserWithEmailAndPassword(current.auth, normalizedEmail, password);
  return created.user;
}

export async function signOutFirebase(): Promise<void> {
  const current = getFirebaseServices();
  if (!current) return;
  await signOut(current.auth);
}
