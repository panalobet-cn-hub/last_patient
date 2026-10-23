"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { LockKeyhole, Check, ScanLine, Search, Skull } from "lucide-react";
import { CLUES } from "@/data/clues";
import { SUSPECTS } from "@/data/suspects";

type Employee = { id: string; name: string; photo_url: string | null };
type Progress = { clue_number: number; completed_at: string };
type GameState = { session: any; progress: Progress[]; winner: any };

export default function Home() {
  const [state, setState] = useState<GameState>({
    session: null,
    progress: [],
    winner: null,
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Employee | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [showRecovery, setShowRecovery] = useState("");
  const [suspect, setSuspect] = useState("");
  const [winnerReveal, setWinnerReveal] = useState<any>(null);
  const scanned = useRef(false);
  const [recordingClue, setRecordingClue] = useState<number | null>(null);
  const loadState = useCallback(async () => {
    const r = await fetch("/api/state", { cache: "no-store" });
    const d = await r.json();
    if (d.session)
      setState({
        session: d.session,
        progress: d.progress ?? [],
        winner: d.winner ?? null,
      });
    else
      setState((s) => ({
        ...s,
        session: null,
        progress: [],
        winner: d.winner ?? null,
      }));
    if (d.winner && !winnerReveal)
      setWinnerReveal({
        outcome:
          d.session?.id === d.winner.session_id ? "you_won" : "already_won",
        employee: d.winner.employees,
        completedAt: d.winner.completed_at,
      });
    return d;
  }, [winnerReveal]);
  useEffect(() => {
    (async () => {
      try {
        await loadState();
        const r = await fetch("/api/register");
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setEmployees(d.employees ?? []);
      } catch (e: any) {
        setError(e.message ?? "Unable to connect to the case file.");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadState]);

  useEffect(() => {
    document.body.classList.toggle("is-loaded", !loading);
    return () => document.body.classList.remove("is-loaded");
  }, [loading]);

  const count = state.progress.length;
  const next = count + 1;
  async function startGame(employee: Employee) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: employee.id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setShowRecovery(d.recoveryCode);
      await loadState();
    } catch (e: any) {
      setError(e.message ?? "Could not start.");
    } finally {
      setBusy(false);
    }
  }
  async function switchInvestigator() {
    const confirmed = window.confirm(
      "Switch players? Your current progress will be saved.",
    );

    if (!confirmed) return;

    setBusy(true);

    try {
      const response = await fetch("/api/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Could not switch investigator.");
      }

      setState({
        session: null,
        progress: [],
        winner: state.winner,
      });

      setSelected(null);
      setShowRecovery("");
      setSuspect("");
      setWinnerReveal(null);

      window.history.replaceState({}, "", window.location.pathname);

      setMessage("Session closed. Select another investigator.");
    } catch (error) {
      setError("Could not switch investigator.");
    } finally {
      setBusy(false);
    }
  }
  async function resumeGame() {
    if (!selected || !recoveryCode.trim()) {
      setError("Select your employee profile and enter the recovery code.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selected.id, recoveryCode }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setRecoveryMode(false);
      setRecoveryCode("");
      await loadState();
      setMessage("Investigation restored. Your evidence is safe.");
    } catch (e: any) {
      setError(e.message ?? "Could not resume investigation.");
    } finally {
      setBusy(false);
    }
  }
  async function scanClue(n: number, key: string) {
    setRecordingClue(n);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const [r] = await Promise.all([
        fetch("/api/clue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clue: n, key }),
        }),
        new Promise((res) => setTimeout(res, 1500)), // keeps loader visible
      ]);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await loadState();
      setMessage(
        d.alreadyComplete
          ? `Clue ${n} was already recorded. Your progress is safe.`
          : `Clue ${n} recorded. Evidence secured.`,
      );
    } catch (e: any) {
      setError(e.message ?? "Could not record clue.");
    } finally {
      setRecordingClue(null);
      setBusy(false);
    }
  }
  useEffect(() => {
    if (loading || scanned.current) return;
    const params = new URLSearchParams(window.location.search);
    const n = Number(params.get("clue"));
    if (n >= 1 && n <= 4) {
      scanned.current = true;
      if (state.session) void scanClue(n, params.get("k") ?? "");
      else
        setMessage(
          `Clue ${n} scanned. Identify yourself below; the clue will be ready to record after you start or resume.`,
        );
    }
  }, [loading, state.session]);
  async function submitAnswer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspect }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (d.outcome === "already_won") {
        setMessage(
          "THE CASE IS CLOSED. Another investigator reached the truth first.",
        );
        await loadState();
      } else {
        setWinnerReveal(d);
        await loadState();
      }
    } catch (e: any) {
      setError(e.message ?? "The accusation could not be verified.");
    } finally {
      setBusy(false);
    }
  }
  const activeEmployee = state.session?.employees as Employee | undefined;
  const alreadyWon = winnerReveal?.outcome === "already_won";
  if (loading)
    return (
      <main className="shell">
        <div className="hero">
          <div className="eyebrow">Patient intake</div>
          <h1 className="title">
            WARD
            <br />
            404
          </h1>
          <p className="subtitle">Opening the case file…</p>
        </div>
      </main>
    );
  if (winnerReveal && winnerReveal.outcome === "you_won")
    return (
      <main className="shell">
        <img
          src="/assets/noise.gif"
          className="noise-overlay"
          alt=""
          aria-hidden="true"
        />
        <div className="topline">
          <span>Asylum incident report</span>
          <span className="sigil">Case closed</span>
        </div>
        <section className="panel winner">
          <div className="stamp">OFFICIAL FINDING</div>
          <div className="eyebrow">The investigation is complete</div>
          <h1 className="title">
            THE CASE
            <br />
            IS CLOSED
          </h1>
          {winnerReveal.employee?.photo_url && (
            <img src={winnerReveal.employee.photo_url} alt="Winner" />
          )}
          <h2>{winnerReveal.employee?.name ?? "Investigator"}</h2>
          <div className="big">THE MURDERER WAS YOU</div>
          <p className="subtitle" style={{ marginTop: 14 }}>
            The suspects were illusions. You were the killer — ward 404 patient
            all along.
          </p>
          <p className="small">
            Verified finish ·{" "}
            {winnerReveal.completedAt
              ? new Date(winnerReveal.completedAt).toLocaleString()
              : ""}
          </p>
          <div className="stamp" style={{ marginTop: 18 }}>
            FIRST TO SOLVE
          </div>
        </section>
        <p className="footer">WARD 404 PATIENT · HALLOWEEN CASE FILE 001</p>
      </main>
    );
  return (
    <main className="shell">
      <video
        className="asylum-background"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
      >
        <source src="/assets/back.mp4" type="video/mp4" />
      </video>

      <div className="topline">
        <span>
          <Skull
            size={13}
            style={{
              display: "inline",
              verticalAlign: "middle",
              marginRight: 6,
            }}
          />{" "}
          Restricted case file
        </span>
        <span className="sigil">Incident 31.10</span>
      </div>
      <header className="hero">
        <div className="eyebrow">Ward 404 Asylum · 11:47 PM</div>
        <h1 className="title">
          WARD
          <br />
          404
        </h1>
        <p className="subtitle">
          Murderer is inside these walls.
          <br />
          {/* <span style={{ color: "#df777d" }}>
            Find the evidence. Face the illusion. Discover who you are.
          </span> */}
        </p>
      </header>
      {winnerReveal?.outcome === "already_won" && (
        <section className="panel">
          <div className="stamp">CASE CLOSED</div>
          <p className="notice">
            Another investigator solved the case first. The winner has been
            recorded.
          </p>
          {winnerReveal.employee?.photo_url && (
            <img
              className="avatar"
              src={winnerReveal.employee.photo_url}
              alt="Winner"
            />
          )}
          <strong>{winnerReveal.employee?.name}</strong>
        </section>
      )}
      {!state.session && !winnerReveal && (
        <>
          <section className="panel">
            <div className="label">01 / Identify yourself</div>
            <p className="small" style={{ lineHeight: 1.6 }}>
              Select Your Profile to start the investigation.
            </p>
            <label className="searchlabel label" htmlFor="employee-search">
              <Search size={12} style={{ display: "inline", marginRight: 5 }} />
              Search investigators
            </label>
            <input
              id="employee-search"
              className="field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your name…"
            />
            <div className="grid">
              {employees
                .filter((p) =>
                  p.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((p) => (
                  <button
                    className="person"
                    key={p.id}
                    onClick={() => setSelected(p)}
                    style={{
                      borderColor:
                        selected?.id === p.id ? "#d24a54" : undefined,
                    }}
                  >
                    {/* <img
                      src={p.photo_url || "/patient-placeholder.svg"}
                      alt=""
                    /> */}
                    <span>{p.name}</span>
                    {selected?.id === p.id && (
                      <small style={{ color: "#ff858b" }}>SELECTED</small>
                    )}
                  </button>
                ))}
            </div>
            {employees.length === 0 && (
              <p className="small">
                No active employee profiles have been added yet. Ask the
                organizer to load the employee list.
              </p>
            )}
            <button
              className="btn"
              disabled={!selected || busy}
              onClick={() => startGame(selected!)}
            >
              ENTER THE ASYLUM
            </button>
            {showRecovery && (
              <div
                className="notice"
                style={{
                  border: "1px solid #5c4a27",
                  borderRadius: 8,
                  marginTop: 12,
                  textAlign: "left",
                }}
              >
                <div className="label" style={{ color: "#e1bd75" }}>
                  Save this recovery code now
                </div>
                <p>
                  Your browser normally remembers you. If the QR opens another
                  browser, select your profile and use this code.
                </p>
                <div
                  style={{
                    font: "700 20px DM Mono,monospace",
                    letterSpacing: 2,
                    color: "#ffe1a4",
                    textAlign: "center",
                  }}
                >
                  {showRecovery}
                </div>
                <button
                  className="btn secondary"
                  style={{ marginTop: 10 }}
                  onClick={() => {
                    navigator.clipboard?.writeText(showRecovery);
                    setMessage(
                      "Recovery code copied if clipboard access is available.",
                    );
                  }}
                >
                  COPY RECOVERY CODE
                </button>
                <button
                  className="btn"
                  style={{ marginTop: 8 }}
                  onClick={() => setShowRecovery("")}
                >
                  I HAVE SAVED IT
                </button>
              </div>
            )}
            <button
              className="btn secondary"
              style={{ marginTop: 9 }}
              onClick={() => {
                setRecoveryMode((v) => !v);
                setError("");
              }}
            >
              {recoveryMode ? "CANCEL RESUME" : "RESUME MY INVESTIGATION"}
            </button>
            {recoveryMode && (
              <div style={{ marginTop: 10 }}>
                <div className="label">Recovery code</div>
                <input
                  className="field"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  placeholder="A1B2C3D4-E5F60718-192A3B4C"
                />
                <button
                  className="btn"
                  onClick={resumeGame}
                  disabled={busy || !selected}
                >
                  RESUME CASE
                </button>
              </div>
            )}
          </section>
        </>
      )}
      {state.session && activeEmployee && !winnerReveal && (
        <>
          <section className="panel">
            <div className="label">Investigator identity confirmed</div>
            <div className="employee">
              <img className="avatar" src={"/patient-placeholder.svg"} alt="" />
              <div>
                <div className="name">{activeEmployee.name}</div>
                <div className="small">
                  ACTIVE INVESTIGATOR · FILE #
                  {state.session.id.slice(0, 8).toUpperCase()}
                </div>
              </div>
              <div style={{ marginLeft: "auto", color: "#9ac98c" }}>
                <Check size={19} />
              </div>
            </div>
            <button
              className="btn secondary"
              style={{ marginTop: 12 }}
              onClick={switchInvestigator}
              disabled={busy}
            >
              SWITCH INVESTIGATOR
            </button>
          </section>
          {showRecovery && (
            <section className="panel">
              <div className="label" style={{ color: "#e1bd75" }}>
                Save your recovery code now
              </div>
              <p className="small" style={{ lineHeight: 1.6 }}>
                Needed only if your phone opens the QR in a different browser.
                This code is shown once.
              </p>
              <div
                style={{
                  font: "700 20px DM Mono,monospace",
                  letterSpacing: 2,
                  color: "#ffe1a4",
                  textAlign: "center",
                  padding: 10,
                }}
              >
                {showRecovery}
              </div>
              <button
                className="btn secondary"
                onClick={() => {
                  navigator.clipboard?.writeText(showRecovery);
                  setMessage(
                    "Recovery code copied if clipboard access is available.",
                  );
                }}
              >
                COPY RECOVERY CODE
              </button>
              <button
                className="btn"
                style={{ marginTop: 8 }}
                onClick={() => setShowRecovery("")}
              >
                I HAVE SAVED IT
              </button>
            </section>
          )}
          <section className="panel">
            <div className="progresshead">
              <div className="label">Investigation progress</div>
              <div className="count">{count} / 4</div>
            </div>
            <div className="bar">
              <div className="barfill" style={{ width: `${count * 25}%` }} />
            </div>
            <div className="clues">
              {CLUES.map((name, i) => {
                const n = i + 1;
                const done = state.progress.some((p) => p.clue_number === n);
                const isNext = !done && n === next;
                return (
                  <div
                    className={`clue ${done ? "done" : ""} ${isNext ? "next" : ""}`}
                    key={n}
                  >
                    <div className="clueIcon">
                      {done ? (
                        <Check size={14} />
                      ) : isNext ? (
                        <ScanLine size={14} />
                      ) : (
                        <LockKeyhole size={12} />
                      )}
                    </div>
                    <div>
                      <div className="clueTitle">
                        {done ? name : `Clue ${n}`}
                      </div>
                    </div>
                    <div className="clueState">
                      {done
                        ? "COMPLETE"
                        : recordingClue === n
                          ? "PROCESSING…"
                          : isNext
                            ? "NEXT"
                            : "LOCKED"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {recordingClue !== null && (
            <div className="recording-overlay">
              <section className="recording-modal">
                <div className="recording-icon">
                  <div className="spinner" />
                </div>

                <p className="recording-kicker">WARD 404</p>

                <h2>Evidence Is Being Recorded</h2>

                {/* <p className="recording-clue">
                  CLUE {recordingClue} · CASE FILE UPDATE
                </p> */}

                <p className="recording-description">
                  Securing evidence and updating the investigation records...
                </p>

                <div className="recording-progress">
                  <div className="recording-progress-bar" />
                </div>

                <p className="recording-warning">DO NOT CLOSE THIS WINDOW</p>
              </section>
            </div>
          )}

          {count < 4 ? (
            <section className="panel">
              <div className="notice">
                {message || (
                  <>
                    Your progress is saved. <strong>Find Clue {next}</strong> in
                    the asylum and scan its QR code using your phone camera.
                  </>
                )}
              </div>
              {new URLSearchParams(
                typeof window !== "undefined" ? window.location.search : "",
              ).has("clue") && (
                <p className="small" style={{ textAlign: "center" }}>
                  If this clue is already marked complete, keep exploring for
                  the next one.
                </p>
              )}
            </section>
          ) : (
            <div className="final-test-overlay">
              <section className="panel final-test">
                <div className="stamp">FINAL TEST</div>
                <div className="question" id="final-test-title">
                  Which figure is waiting inside your mind?
                </div>
                <p className="small" style={{ lineHeight: 1.6 }}>
                  Choose the murderer based on your investigation.
                </p>
                <form onSubmit={submitAnswer}>
                  <div className="suspectGrid">
                    {SUSPECTS.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className={`suspectCard ${
                          suspect === item.id ? "selected" : ""
                        }`}
                        onClick={() => setSuspect(item.id)}
                      >
                        <span className="suspectMark">Suspect {item.mark}</span>
                        <img
                          className="suspectImage"
                          src={item.image}
                          alt={item.name}
                        />

                        <strong>{item.name}</strong>

                        <span>{item.desc}</span>
                      </button>
                    ))}
                  </div>
                  <button className="btn" disabled={busy || !suspect}>
                    CONFIRM
                  </button>
                </form>
              </section>
            </div>
          )}
        </>
      )}

      {message && !state.session && (
        <div className="error-overlay">
          <section className="panel error-modal" id="error">
            <p className="error">{message}</p>
            <button className="btn" onClick={() => setMessage("")}>
              OK
            </button>
          </section>
        </div>
      )}

      {error && (
        <div className="error-overlay">
          <section className="panel error-modal" id="error">
            <p className="error">{error}</p>
            <button className="btn" onClick={() => setError("")}>
              OK
            </button>
          </section>
        </div>
      )}

      {/* <p className="footer">
        NO PHONE TRICKS. NO SECOND CHANCES. FOLLOW THE EVIDENCE.
      </p> */}
    </main>
  );
}
