"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { saveDecisionToFirebase } from "@/lib/firebase/data";
import { AR_CONSULTATION_FOCUSES, WRITING_MODES } from "@/lib/modes";
import { analyzeLyrics } from "@/lib/lyric-analysis";
import { VideoDirector } from "@/components/VideoDirector";
import type {
  ArConsultationFocusId,
  ContentLevel,
  DecisionRecord,
  DecisionStatus,
  GenerateRequest,
  GenerateResponse,
  ModeId,
  ResearchPacket,
  TechniqueRatings,
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
  research?: ResearchPacket;
};

const initialRequest: GenerateRequest = {
  mode: "full-song",
  prompt: "",
  sourceLyrics: "",
  lockedLyrics: "",
  maxCharacters: 3500,
  creativity: 0.78,
  contentLevel: "explicit",
  consultationFocus: "first-run-assignment",
  liveResearch: true,
};

const WRITING_RATINGS: TechniqueRatings = {
  hook: 5,
  verses: 5,
  rhyme: 5,
  originality: 5,
  emotion: 5,
  replay: 5,
};

const AR_RATINGS: TechniqueRatings = {
  accuracy: 5,
  specificity: 5,
  honesty: 5,
  strategy: 5,
  actionability: 5,
  currentness: 5,
};

const HISTORY_KEY = "trizzy-writer-history-v2";
const DECISIONS_KEY = "trizzy-writer-decisions-v2";

function safeFileName(value: string): string {
  const clean = value
    .replace(/\[[^\]]+\]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return clean.slice(0, 48) || "trizzy-writer-output";
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

function sourceDate(value?: string): string {
  if (!value) return "Date not supplied";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export default function Home() {
  const [request, setRequest] = useState<GenerateRequest>(initialRequest);
  const [output, setOutput] = useState("");
  const [model, setModel] = useState("");
  const [provider, setProvider] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [research, setResearch] = useState<ResearchPacket | undefined>();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [originalOutput, setOriginalOutput] = useState("");
  const [userNotes, setUserNotes] = useState("");
  const [userRatings, setUserRatings] = useState<TechniqueRatings>(WRITING_RATINGS);
  const [health, setHealth] = useState<HealthState>({
    status: "checking",
    detail: "Checking model connection...",
    model: "",
    provider: "",
  });
  const abortRef = useRef<AbortController | null>(null);

  const isArMode = request.mode === "inside-ar";
  const selectedMode = useMemo(
    () => WRITING_MODES.find((item) => item.id === request.mode) || WRITING_MODES[0],
    [request.mode],
  );
  const selectedArFocus = useMemo(
    () =>
      AR_CONSULTATION_FOCUSES.find((item) => item.id === request.consultationFocus) ||
      AR_CONSULTATION_FOCUSES[0],
    [request.consultationFocus],
  );
  const lyricAnalysis = useMemo(
    () => (!isArMode && output ? analyzeLyrics(output) : null),
    [isArMode, output],
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

  useEffect(() => {
    setUserRatings(isArMode ? { ...AR_RATINGS } : { ...WRITING_RATINGS });
    setUserNotes("");
  }, [isArMode]);

  function updateRequest<K extends keyof GenerateRequest>(key: K, value: GenerateRequest[K]): void {
    setRequest((current) => ({ ...current, [key]: value }));
  }

  function selectMode(mode: ModeId): void {
    setRequest((current) => ({
      ...current,
      mode,
      maxCharacters:
        mode === "inside-ar" && current.maxCharacters < 6000 ? 7000 : current.maxCharacters,
      consultationFocus: current.consultationFocus || "first-run-assignment",
      liveResearch: current.liveResearch ?? true,
    }));
    setResearch(undefined);
    setWarnings([]);
    setMessage(mode === "inside-ar" ? "Inside A&R consultation mode opened." : "Writing mode opened.");
  }

  function selectArFocus(focusId: ArConsultationFocusId): void {
    const focus = AR_CONSULTATION_FOCUSES.find((item) => item.id === focusId);
    setRequest((current) => ({
      ...current,
      consultationFocus: focusId,
      prompt: current.prompt.trim() ? current.prompt : focus?.starter || current.prompt,
    }));
  }

  function loadArAssignment(): void {
    setRequest((current) => ({ ...current, prompt: selectedArFocus.starter }));
    setMessage(`${selectedArFocus.name} assignment loaded.`);
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
      setMessage(isArMode ? "Tell your Inside A&R what to evaluate or decide." : "Tell Trizzy Writer what to create or revise.");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setMessage(isArMode && request.liveResearch ? "Researching current evidence before the consultation..." : "");
    setWarnings([]);
    setResearch(undefined);

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
      setOriginalOutput(data.text);
      setUserNotes("");
      setModel(data.model);
      setProvider(data.provider);
      setWarnings(data.warnings);
      setResearch(data.research);
      setMessage(
        data.repaired
          ? `${isArMode ? "Consultation" : "Writing"} completed and automatically repaired.`
          : `${isArMode ? "A&R consultation" : "Generation"} complete.`,
      );

      const item: HistoryItem = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        request: { ...request },
        output: data.text,
        model: data.model,
        ...(data.research ? { research: data.research } : {}),
      };
      persistHistory([item, ...history].slice(0, 30));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessage("Request stopped.");
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
      originalOutput,
      userRatings,
      userNotes: userNotes.trim(),
      ...(!isArMode ? { lyricAnalysis: analyzeLyrics(output) } : {}),
      ...(research ? { research } : {}),
    };
    persistDecisions([decision, ...decisions]);

    try {
      const destination = await saveDecisionToFirebase(decision);
      const exampleType = isArMode ? "A&R consultation" : "writing";
      setMessage(
        destination === "firebase"
          ? `${status === "approved" ? "Approved" : "Rejected"} ${exampleType} example saved to Firebase.`
          : `${status === "approved" ? "Approved" : "Rejected"} ${exampleType} example saved locally. Configure Firebase to sync it.`,
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
    setMessage(isArMode ? "A&R consultation exported as a text file." : "Song exported as a text file.");
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
              content: `Trizzy Writer approved example. Mode: ${item.mode}. Content level: ${item.contentLevel}. A&R focus: ${item.consultationFocus || "none"}. Character limit: ${item.maxCharacters}.`,
            },
            {
              role: "user",
              content: [
                item.prompt,
                item.sourceLyrics ? `SOURCE OR MATERIAL:\n${item.sourceLyrics}` : "",
                item.lockedLyrics ? `LOCKED OR CLIENT FACTS:\n${item.lockedLyrics}` : "",
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
            contentLevel: item.contentLevel,
            consultationFocus: item.consultationFocus,
            liveResearch: item.liveResearch,
            createdAt: item.createdAt,
            originalOutput: item.originalOutput,
            userRatings: item.userRatings,
            userNotes: item.userNotes,
            lyricAnalysis: item.lyricAnalysis,
            research: item.research,
          },
        }),
      )
      .join("\n");

    downloadFile(jsonl, "trizzy-writer-approved-examples.jsonl", "application/x-ndjson;charset=utf-8");
    setMessage(`Exported ${approved.length} approved training examples.`);
  }

  function loadHistory(item: HistoryItem): void {
    setRequest({ ...initialRequest, ...item.request });
    setOutput(item.output);
    setOriginalOutput(item.output);
    setModel(item.model);
    setResearch(item.research);
    setWarnings([]);
    setMessage(`Loaded session from ${new Date(item.createdAt).toLocaleString()}.`);
  }

  function newSession(): void {
    setRequest(initialRequest);
    setOutput("");
    setOriginalOutput("");
    setResearch(undefined);
    setUserNotes("");
    setWarnings([]);
    setMessage("New session opened.");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">PRIVATE AI SONGWRITING + INSIDE A&R WORKSPACE</p>
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
              <p className="label">Operating mode</p>
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
                onClick={() => selectMode(mode.id as ModeId)}
              >
                <strong>{mode.name}</strong>
                <span>{mode.description}</span>
              </button>
            ))}
          </div>

          {isArMode ? (
            <>
              <div className="field">
                <span>A&R consultation</span>
                <div className="consultation-grid" role="group" aria-label="A&R consultation focus">
                  {AR_CONSULTATION_FOCUSES.map((focus) => (
                    <button
                      className={`consultation-card ${request.consultationFocus === focus.id ? "active" : ""}`}
                      key={focus.id}
                      type="button"
                      onClick={() => selectArFocus(focus.id)}
                    >
                      <strong>{focus.name}</strong>
                      <span>{focus.description}</span>
                    </button>
                  ))}
                </div>
                <button className="load-assignment-button" type="button" onClick={loadArAssignment}>
                  Load {selectedArFocus.name} assignment
                </button>
              </div>

              <div className="research-toggle">
                <div>
                  <strong>Live current research</strong>
                  <span>Search public web and music news before the model advises you.</span>
                </div>
                <button
                  className={request.liveResearch ? "active" : ""}
                  type="button"
                  aria-pressed={Boolean(request.liveResearch)}
                  onClick={() => updateRequest("liveResearch", !request.liveResearch)}
                >
                  {request.liveResearch ? "On" : "Off"}
                </button>
              </div>
            </>
          ) : (
            <div className="field">
              <span>Content level</span>
              <div className="content-level-grid" role="group" aria-label="Content level">
                {([
                  ["clean", "Clean", "Broad-release language"],
                  ["explicit", "Explicit", "Profanity and adult themes"],
                  ["raw-adult", "Raw Adult", "Maximum adult creative freedom"],
                ] as const).map(([level, label, description]) => (
                  <button
                    className={`content-level-card ${request.contentLevel === level ? "active" : ""}`}
                    key={level}
                    type="button"
                    onClick={() => updateRequest("contentLevel", level as ContentLevel)}
                  >
                    <strong>{label}</strong>
                    <span>{description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="field">
            <span>{isArMode ? "Consultation request" : "Main direction"}</span>
            <textarea
              value={request.prompt}
              onChange={(event) => updateRequest("prompt", event.target.value)}
              placeholder={
                isArMode
                  ? selectedArFocus.starter
                  : "Write a complete song about realizing somebody wanted access to me, not responsibility for me..."
              }
              rows={isArMode ? 8 : 6}
            />
          </label>

          <label className="field">
            <span>{isArMode ? "Song, plan, offer, analytics, or material to evaluate" : "Source lyrics or cadence reference"}</span>
            <textarea
              value={request.sourceLyrics}
              onChange={(event) => updateRequest("sourceLyrics", event.target.value)}
              placeholder={
                isArMode
                  ? "Paste lyrics, a rollout plan, an offer, analytics, a bio, a tracklist, or any material the A&R should review."
                  : "Paste lyrics to remix, preserve, or improve."
              }
              rows={6}
            />
          </label>

          <label className={`field ${isArMode ? "" : "locked-field"}`}>
            <span>{isArMode ? "Client facts and non-negotiables" : "Locked lyrics"}</span>
            <textarea
              value={request.lockedLyrics}
              onChange={(event) => updateRequest("lockedLyrics", event.target.value)}
              placeholder={
                isArMode
                  ? "Add private context, confirmed facts, budget limits, deadlines, or decisions that must be respected."
                  : "Anything placed here must remain letter-for-letter unchanged."
              }
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
              <span>{isArMode ? "Judgment range" : "Creativity"} {request.creativity.toFixed(2)}</span>
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
              {loading ? (isArMode ? "Consulting..." : "Writing...") : isArMode ? "Consult Inside A&R" : "Generate"}
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
              {isArMode ? ` | research ${request.liveResearch ? "enabled" : "disabled"}` : ""}
            </span>
          </div>
        </aside>

        <section className="output-panel glass-panel">
          <div className="panel-heading output-heading">
            <div>
              <p className="label">{isArMode ? "Private A&R consultation" : "Final writing"}</p>
              <h2>{output ? `${output.length.toLocaleString()} characters` : isArMode ? "Ready for an executive decision" : "Ready for direction"}</h2>
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
            placeholder={
              isArMode
                ? "Your dated, source-grounded A&R verdict and action plan will appear here."
                : "Your generated song or revision will appear here. Edit it before approving it for future fine-tuning."
            }
            spellCheck
          />

          {isArMode && research ? (
            <section className="research-panel">
              <div className="research-heading">
                <div>
                  <p className="label">Current intelligence</p>
                  <h3>{research.sources.length} retrieved sources</h3>
                </div>
                <span>As of {new Date(research.asOf).toLocaleString()}</span>
              </div>
              {research.sources.length ? (
                <div className="research-list">
                  {research.sources.map((source) => (
                    <a href={source.url} key={source.id} target="_blank" rel="noreferrer">
                      <strong>[{source.id}] {source.title}</strong>
                      <span>{source.source} · {source.kind} · {sourceDate(source.publishedAt)}</span>
                      <p>{source.excerpt}</p>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="empty-research">No usable sources were retrieved. Current claims should be treated as unverified.</p>
              )}
            </section>
          ) : null}

          {output ? (
            isArMode ? (
              <section className="dna-panel">
                <div className="dna-heading">
                  <div>
                    <p className="label">Train your Inside A&R</p>
                    <h3>Executive consultation feedback</h3>
                  </div>
                </div>
                <div className="preference-panel ar-preference-panel">
                  <h4>Score the consultation before approving it</h4>
                  <div className="rating-grid">
                    {Object.entries(userRatings).map(([key, value]) => (
                      <label key={key}>
                        <span>{key}</span>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={value}
                          onChange={(event) =>
                            setUserRatings((current) => ({ ...current, [key]: Number(event.target.value) }))
                          }
                        />
                        <strong>{value}</strong>
                      </label>
                    ))}
                  </div>
                  <textarea
                    rows={4}
                    value={userNotes}
                    onChange={(event) => setUserNotes(event.target.value)}
                    placeholder="What did the A&R understand correctly? What was generic, inaccurate, too soft, too expensive, or missing?"
                  />
                </div>
              </section>
            ) : lyricAnalysis ? (
              <section className="dna-panel">
                <div className="dna-heading">
                  <div><p className="label">Lyric DNA</p><h3>Automatic technique analysis</h3></div>
                  <strong>{lyricAnalysis.scores.overall}/10</strong>
                </div>
                <div className="score-grid">
                  {Object.entries(lyricAnalysis.scores)
                    .filter(([key]) => key !== "overall")
                    .map(([key, value]) => (
                      <article key={key}>
                        <span>{key.replace(/([A-Z])/g, " $1")}</span>
                        <strong>{value}</strong>
                        <div><i style={{ width: `${value * 10}%` }} /></div>
                      </article>
                    ))}
                </div>
                <div className="critic-grid">
                  <div><h4>Strengths</h4>{lyricAnalysis.strengths.map((item) => <p key={item}>+ {item}</p>)}</div>
                  <div><h4>Improve next</h4>{lyricAnalysis.improvements.map((item) => <p key={item}>- {item}</p>)}</div>
                </div>
                <div className="preference-panel">
                  <h4>Teach Trizzy Writer your taste</h4>
                  <div className="rating-grid">
                    {Object.entries(userRatings).map(([key, value]) => (
                      <label key={key}>
                        <span>{key}</span>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={value}
                          onChange={(event) =>
                            setUserRatings((current) => ({ ...current, [key]: Number(event.target.value) }))
                          }
                        />
                        <strong>{value}</strong>
                      </label>
                    ))}
                  </div>
                  <textarea
                    rows={3}
                    value={userNotes}
                    onChange={(event) => setUserNotes(event.target.value)}
                    placeholder="Why did you approve, reject, or edit this? These notes become preference-learning data."
                  />
                </div>
              </section>
            ) : null
          ) : null}

          <footer className="output-footer">
            <span>{message || (isArMode ? "Approved consultations become A&R training examples." : "Approved outputs become clean training examples.")}</span>
            <span>{model || "Configurable model endpoint"}</span>
          </footer>
        </section>
      </section>

      {!isArMode ? <VideoDirector lyrics={output} /> : null}

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
