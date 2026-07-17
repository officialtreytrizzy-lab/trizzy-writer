"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { saveDecisionToFirebase } from "@/lib/firebase/data";
import { WRITING_MODES } from "@/lib/modes";
import type {
  DecisionRecord,
  DecisionStatus,
  GenerateRequest,
  GenerateResponse,
  ModeId,
} from "@/lib/types";

type HealthState = {
  status: "checking" | "ready" | "offline";
  detail: string;
  model: string;
  provider: string;
};

type HistoryItem = {
  id: string;
  createdAt: string;
  request: GenerateRequest;
  output: string;
  model: string;
};

const initialRequest: GenerateRequest = {
  mode: "full-song",
  prompt: "",
  sourceLyrics: "",
  lockedLyrics: "",
  maxCharacters: 3500,
  creativity: 0.78,
};

const HISTORY_KEY = "trizzy-writer-history-v1";
const DECISIONS_KEY = "trizzy-writer-decisions-v1";

function safeFileName(value: string): string {
  const clean = value
    .replace(/\[[^\]]+\]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return clean.slice(0, 48) || "trizzy-writer-song";
}

function downloadFile(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [request, setRequest] = useState<GenerateRequest>(initialRequest);
  const [output, setOutput] = useState("");
  const [model, setModel] = useState("");
  const [provider, setProvider] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [health, setHealth] = useState<HealthState>({
    status: "checking",
    detail: "Checking model connection...",
    model: "",
    provider: "",
  });
  const abortRef = useRef<AbortController | null>(null);

  const selectedMode = useMemo(
    () => WRITING_MODES.find((item) => item.id === request.mode) || WRITING_MODES[0],
    [request.mode],
  );

  const checkHealth = useCallback(async () => {
    setHealth((current) => ({ ...current, status: "checking", detail: "Checking model connection..." }));
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const data = (await response.json()) as {
        ok?: boolean;
        detail?: string;
        model?: string;
        provider?: string;
      };
      setModel(data.model || "");
      setProvider(data.provider || "");
      setHealth({
        status: response.ok && data.ok ? "ready" : "offline",
        detail: data.detail || "The model is unavailable.",
        model: data.model || "",
        provider: data.provider || "",
      });
    } catch {
      setHealth({
        status: "offline",
        detail: "Could not check the model endpoint.",
        model: "",
        provider: "",
      });
    }
  }, []);

  useEffect(() => {
    void checkHealth();
    try {
      const savedHistory = window.localStorage.getItem(HISTORY_KEY);
      const savedDecisions = window.localStorage.getItem(DECISIONS_KEY);
      if (savedHistory) setHistory(JSON.parse(savedHistory) as HistoryItem[]);
      if (savedDecisions) setDecisions(JSON.parse(savedDecisions) as DecisionRecord[]);
    } catch {
      setHistory([]);
      setDecisions([]);
    }
  }, [checkHealth]);

  function updateRequest<K extends keyof GenerateRequest>(key: K, value: GenerateRequest[K]): void {
    setRequest((current) => ({ ...current, [key]: value }));
  }

  function persistHistory(items: HistoryItem[]): void {
    setHistory(items);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  }

  function persistDecisions(items: DecisionRecord[]): void {
    setDecisions(items);
    window.localStorage.setItem(DECISIONS_KEY, JSON.stringify(items));
  }

  async function generate(): Promise<void> {
    if (!request.prompt.trim()) {
      setMessage("Tell Trizzy Writer what to create or revise.");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setMessage("");
    setWarnings([]);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      const data = (await response.json()) as GenerateResponse | { error: string };
      if (!response.ok || !("text" in data)) {
        throw new Error("error" in data ? data.error : "Generation failed.");
      }

      setOutput(data.text);
      setModel(data.model);
      setProvider(data.provider);
      setWarnings(data.warnings);
      setMessage(data.repaired ? "Generated and automatically repaired." : "Generation complete.");

      const item: HistoryItem = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        request: { ...request },
        output: data.text,
        model: data.model,
      };
      persistHistory([item, ...history].slice(0, 30));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessage("Generation stopped.");
      } else {
        setMessage(error instanceof Error ? error.message : "Generation failed.");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  async function saveDecision(status: DecisionStatus): Promise<void> {
    if (!output.trim()) return;

    const decision: DecisionRecord = {
      ...request,
      id: crypto.randomUUID(),
      output,
      status,
      createdAt: new Date().toISOString(),
      model: model || "unknown",
    };
    persistDecisions([decision, ...decisions]);

    try {
      const destination = await saveDecisionToFirebase(decision);
      setMessage(
        destination === "firebase"
          ? `${status === "approved" ? "Approved" : "Rejected"} example saved to Firebase.`
          : `${status === "approved" ? "Approved" : "Rejected"} example saved locally. Configure Firebase to sync it.`,
      );
    } catch (error) {
      setMessage(
        `${status === "approved" ? "Approved" : "Rejected"} example saved locally. Firebase sync failed: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
  }

  function exportOutput(): void {
    if (!output) return;
    downloadFile(output, `${safeFileName(request.prompt)}.txt`, "text/plain;charset=utf-8");
    setMessage("Song exported as a text file.");
  }

  function exportDataset(): void {
    const approved = decisions.filter((item) => item.status === "approved");
    if (!approved.length) {
      setMessage("Approve at least one result before exporting the training dataset.");
      return;
    }

    const jsonl = approved
      .map((item) =>
        JSON.stringify({
          messages: [
            {
              role: "system",
              content: `Trizzy Writer approved example. Mode: ${item.mode}. Character limit: ${item.maxCharacters}.`,
            },
            {
              role: "user",
              content: [
                item.prompt,
                item.sourceLyrics ? `SOURCE:\n${item.sourceLyrics}` : "",
                item.lockedLyrics ? `LOCKED:\n${item.lockedLyrics}` : "",
              ]
                .filter(Boolean)
                .join("\n\n"),
            },
            { role: "assistant", content: item.output },
          ],
          metadata: {
            id: item.id,
            model: item.model,
            mode: item.mode,
            createdAt: item.createdAt,
          },
        }),
      )
      .join("\n");

    downloadFile(jsonl, "trizzy-writer-approved-examples.jsonl", "application/x-ndjson;charset=utf-8");
    setMessage(`Exported ${approved.length} approved training examples.`);
  }

  function loadHistory(item: HistoryItem): void {
    setRequest(item.request);
    setOutput(item.output);
    setModel(item.model);
    setWarnings([]);
    setMessage(`Loaded session from ${new Date(item.createdAt).toLocaleString()}.`);
  }

  function newSession(): void {
    setRequest(initialRequest);
    setOutput("");
    setWarnings([]);
    setMessage("New session opened.");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">PRIVATE AI SONGWRITING WORKSPACE</p>
          <h1>TRIZZY WRITER</h1>
        </div>
        <div className="status-area">
          <button className="ghost-button" type="button" onClick={exportDataset}>
            Export dataset
          </button>
          <button className="ghost-button" type="button" onClick={newSession}>
            New session
          </button>
          <button className="status-pill" type="button" onClick={() => void checkHealth()}>
            <span className={`status-dot ${health.status}`} />
            {health.status === "ready" ? "Model ready" : health.status === "checking" ? "Checking" : "Offline"}
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="control-panel glass-panel">
          <div className="panel-heading">
            <div>
              <p className="label">Writing mode</p>
              <h2>{selectedMode.name}</h2>
            </div>
            <span className="number-chip">01</span>
          </div>

          <div className="mode-grid">
            {WRITING_MODES.map((mode) => (
              <button
                className={`mode-card ${request.mode === mode.id ? "active" : ""}`}
                key={mode.id}
                type="button"
                onClick={() => updateRequest("mode", mode.id as ModeId)}
              >
                <strong>{mode.name}</strong>
                <span>{mode.description}</span>
              </button>
            ))}
          </div>

          <label className="field">
            <span>Main direction</span>
            <textarea
              value={request.prompt}
              onChange={(event) => updateRequest("prompt", event.target.value)}
              placeholder="Write a complete song about realizing somebody wanted access to me, not responsibility for me..."
              rows={6}
            />
          </label>

          <label className="field">
            <span>Source lyrics or cadence reference</span>
            <textarea
              value={request.sourceLyrics}
              onChange={(event) => updateRequest("sourceLyrics", event.target.value)}
              placeholder="Paste lyrics to remix, preserve, or improve."
              rows={6}
            />
          </label>

          <label className="field locked-field">
            <span>Locked lyrics</span>
            <textarea
              value={request.lockedLyrics}
              onChange={(event) => updateRequest("lockedLyrics", event.target.value)}
              placeholder="Anything placed here must remain letter-for-letter unchanged."
              rows={5}
            />
          </label>

          <div className="settings-grid">
            <label className="field compact-field">
              <span>Character limit</span>
              <input
                type="number"
                min={300}
                max={12000}
                step={100}
                value={request.maxCharacters}
                onChange={(event) => updateRequest("maxCharacters", Number(event.target.value))}
              />
            </label>
            <label className="field compact-field">
              <span>Creativity {request.creativity.toFixed(2)}</span>
              <input
                type="range"
                min={0.2}
                max={1.1}
                step={0.01}
                value={request.creativity}
                onChange={(event) => updateRequest("creativity", Number(event.target.value))}
              />
            </label>
          </div>

          <div className="generate-row">
            <button className="primary-button" type="button" onClick={() => void generate()} disabled={loading}>
              {loading ? "Writing..." : "Generate"}
            </button>
            {loading ? (
              <button className="danger-button" type="button" onClick={() => abortRef.current?.abort()}>
                Stop
              </button>
            ) : null}
          </div>

          <div className="connection-card">
            <strong>{health.detail}</strong>
            <span>
              {isFirebaseConfigured ? "Firebase sync configured" : "Local-only data mode"}
              {health.provider ? ` | ${health.provider}` : ""}
            </span>
          </div>
        </aside>

        <section className="output-panel glass-panel">
          <div className="panel-heading output-heading">
            <div>
              <p className="label">Final writing</p>
              <h2>{output ? `${output.length.toLocaleString()} characters` : "Ready for direction"}</h2>
            </div>
            <div className="action-row">
              <button
                type="button"
                onClick={() => {
                  if (!output) return;
                  void navigator.clipboard.writeText(output);
                  setMessage("Copied to clipboard.");
                }}
                disabled={!output}
              >
                Copy
              </button>
              <button type="button" onClick={exportOutput} disabled={!output}>
                Export
              </button>
              <button className="reject-button" type="button" onClick={() => void saveDecision("rejected")} disabled={!output}>
                Reject
              </button>
              <button className="approve-button" type="button" onClick={() => void saveDecision("approved")} disabled={!output}>
                Approve
              </button>
            </div>
          </div>

          {warnings.length ? (
            <div className="warning-box">
              {warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          <textarea
            className="output-editor"
            value={output}
            onChange={(event) => setOutput(event.target.value)}
            placeholder="Your generated song or revision will appear here. Edit it before approving it for future fine-tuning."
            spellCheck
          />

          <footer className="output-footer">
            <span>{message || "Approved outputs become clean training examples."}</span>
            <span>{model || "Configurable model endpoint"}</span>
          </footer>
        </section>
      </section>

      <section className="stats-row">
        <article>
          <strong>{history.length}</strong>
          <span>Recent sessions</span>
        </article>
        <article>
          <strong>{decisions.filter((item) => item.status === "approved").length}</strong>
          <span>Approved examples</span>
        </article>
        <article>
          <strong>{decisions.filter((item) => item.status === "rejected").length}</strong>
          <span>Rejected examples</span>
        </article>
      </section>

      {history.length ? (
        <section className="history-section">
          <div className="history-heading">
            <div>
              <p className="eyebrow">LOCAL HISTORY</p>
              <h2>Recent sessions</h2>
            </div>
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                persistHistory([]);
                setMessage("Local session history cleared.");
              }}
            >
              Clear history
            </button>
          </div>
          <div className="history-grid">
            {history.map((item) => (
              <button className="history-card" key={item.id} type="button" onClick={() => loadHistory(item)}>
                <span>{WRITING_MODES.find((mode) => mode.id === item.request.mode)?.name}</span>
                <strong>{item.request.prompt}</strong>
                <small>{new Date(item.createdAt).toLocaleString()}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
