"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import {
  createEmailAccount,
  isFirebaseConfigured,
  observeFirebaseUser,
  signInAsGuest,
  signInWithEmail,
  signInWithGoogle,
  signOutFirebase,
} from "@/lib/firebase/client";
import styles from "./FirebaseAccountBar.module.css";

type AuthMode = "signin" | "create";

function describeUser(user: User | null): string {
  if (!user) return "Not signed in";
  if (user.isAnonymous) return "Guest workspace";
  return user.displayName || user.email || "Firebase account";
}

function friendlyError(error: unknown): string {
  const fallback = error instanceof Error ? error.message : "Authentication failed.";
  if (!error || typeof error !== "object" || !("code" in error)) return fallback;

  const code = String(error.code);
  if (code.includes("popup-closed-by-user")) return "Google sign-in was closed before it finished.";
  if (code.includes("invalid-credential")) return "The email or password is incorrect.";
  if (code.includes("email-already-in-use")) return "That email already has an account. Sign in instead.";
  if (code.includes("weak-password")) return "Use a password with at least six characters.";
  if (code.includes("invalid-email")) return "Enter a valid email address.";
  if (code.includes("operation-not-allowed")) return "Enable this sign-in method in Firebase Authentication.";
  return fallback;
}

export function FirebaseAccountBar() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!isFirebaseConfigured);
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return observeFirebaseUser((nextUser) => {
      setUser(nextUser);
      setReady(true);
    });
  }, []);

  async function run(action: () => Promise<unknown>, successMessage: string): Promise<void> {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(successMessage);
      setExpanded(false);
      setPassword("");
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!email.trim() || !password) {
      setMessage("Enter both your email and password.");
      return;
    }

    if (mode === "create") {
      await run(() => createEmailAccount(email, password), "Account created and connected.");
      return;
    }
    await run(() => signInWithEmail(email, password), "Signed in successfully.");
  }

  if (!isFirebaseConfigured) {
    return (
      <div className={styles.localBar} role="status">
        <span className={styles.dot} />
        <strong>Local mode</strong>
        <span>Firebase is optional until its public web configuration is added.</span>
      </div>
    );
  }

  return (
    <section className={styles.shell} aria-label="Trizzy Writer account">
      <div className={styles.summary}>
        <div className={styles.identity}>
          <span className={`${styles.dot} ${user ? styles.online : ""}`} />
          <div>
            <strong>{ready ? describeUser(user) : "Checking account..."}</strong>
            <span>{user?.isAnonymous ? "Save work temporarily or connect an account" : "Firebase sync enabled"}</span>
          </div>
        </div>

        <div className={styles.actions}>
          {user && !user.isAnonymous ? (
            <button type="button" onClick={() => void run(signOutFirebase, "Signed out.")} disabled={busy}>
              Sign out
            </button>
          ) : (
            <button type="button" onClick={() => setExpanded((value) => !value)} disabled={!ready || busy}>
              {expanded ? "Close" : user?.isAnonymous ? "Connect account" : "Sign in"}
            </button>
          )}
        </div>
      </div>

      {expanded && (!user || user.isAnonymous) ? (
        <div className={styles.panel}>
          <button
            className={styles.googleButton}
            type="button"
            onClick={() => void run(signInWithGoogle, "Google account connected.")}
            disabled={busy}
          >
            Continue with Google
          </button>

          <div className={styles.divider}><span>or use email</span></div>

          <div className={styles.modeSwitch}>
            <button
              className={mode === "signin" ? styles.active : ""}
              type="button"
              onClick={() => setMode("signin")}
            >
              Sign in
            </button>
            <button
              className={mode === "create" ? styles.active : ""}
              type="button"
              onClick={() => setMode("create")}
            >
              Create account
            </button>
          </div>

          <form className={styles.form} onSubmit={(event) => void submitEmail(event)}>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email address"
              autoComplete="email"
              disabled={busy}
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              autoComplete={mode === "create" ? "new-password" : "current-password"}
              minLength={6}
              disabled={busy}
            />
            <button className={styles.submitButton} type="submit" disabled={busy}>
              {busy ? "Working..." : mode === "create" ? "Create account" : "Sign in"}
            </button>
          </form>

          {!user ? (
            <button
              className={styles.guestButton}
              type="button"
              onClick={() => void run(signInAsGuest, "Guest workspace started.")}
              disabled={busy}
            >
              Continue as guest
            </button>
          ) : null}
        </div>
      ) : null}

      {message ? <p className={styles.message}>{message}</p> : null}
    </section>
  );
}
