"use client";

import "./admin.css";
import { useEffect, useState } from "react";

type Session = {
  id: string;
  employee_name: string;
  active: boolean;
  completed_at: string | null;
  clue_count: number;
};

export default function SessionManagementPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  async function loadSessions() {
    setLoading(true);

    try {
      const response = await fetch("/api/admin/sessions", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load sessions");
      }

      setSessions(data.sessions || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  async function resetSession(session: Session) {
    const confirmed = window.confirm(
      `Reset ${session.employee_name}'s session? Their clue progress will be deleted.`,
    );

    if (!confirmed) return;

    setBusyId(session.id);
    setMessage("");

    try {
      const response = await fetch("/api/admin/sessions/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Reset failed");
      }

      setMessage(`Session reset for ${session.employee_name}.`);
      await loadSessions();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reset failed");
    } finally {
      setBusyId("");
    }
  }

  function getStatus(session: Session) {
    if (session.completed_at) return { label: "Completed", cls: "done" };
    if (session.active) return { label: "In progress", cls: "live" };
    return { label: "Inactive", cls: "" };
  }

  return (
    <main className="adminShell">
      <div className="hero">
        <div className="eyebrow">Ward 404</div>
        <h1 className="title session">Session Management</h1>
        <p className="subtitle">
          Review player progress and reset accidental registrations.
        </p>
      </div>

      <div style={{ textAlign: "center" }}>
        <button
          className="btn secondary inline"
          onClick={() => void loadSessions()}
        >
          Refresh sessions
        </button>
      </div>

      {message && (
        <p role="status" className="notice">
          <strong>{message}</strong>
        </p>
      )}

      <section className="panel">
        {loading ? (
          <p className="emptyRow">Loading sessions...</p>
        ) : (
          <div className="tableWrap">
            <table className="sessionTable">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Clues</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {sessions.map((session) => {
                  const status = getStatus(session);

                  return (
                    <tr key={session.id}>
                      <td className="sessionName">{session.employee_name}</td>
                      <td>{session.clue_count}/4</td>
                      <td>
                        <span className={`statusBadge ${status.cls}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="actionCell">
                        {session.active && !session.completed_at && (
                          <button
                            className="btn inline"
                            disabled={busyId === session.id}
                            onClick={() => void resetSession(session)}
                          >
                            {busyId === session.id
                              ? "Resetting..."
                              : "Reset session"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="emptyRow">
                      No sessions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
