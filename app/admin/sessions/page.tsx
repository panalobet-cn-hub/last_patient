"use client";

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

  return (
    <main className="min-h-screen bg-[#100b0d] p-6 text-white sm:p-10">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm uppercase tracking-[0.3em] text-red-500">
          The Last Patient
        </p>

        <h1 className="mt-3 text-3xl font-bold">Session Management</h1>

        <p className="mt-2 text-sm text-gray-400">
          Review player progress and reset accidental registrations.
        </p>

        <button
          onClick={() => void loadSessions()}
          className="mt-6 rounded-lg border border-red-900 px-4 py-2 hover:bg-red-950"
        >
          Refresh sessions
        </button>

        {message && (
          <p role="status" className="my-4 text-sm text-red-300">
            {message}
          </p>
        )}

        {loading ? (
          <p className="mt-8 text-gray-400">Loading sessions...</p>
        ) : (
          <div className="mt-6 space-y-3">
            {sessions.map((session) => (
              <section
                key={session.id}
                className="rounded-xl border border-red-950 bg-[#1a1215] p-5"
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="font-semibold">{session.employee_name}</h2>

                    <p className="mt-1 text-sm text-gray-400">
                      Clues: {session.clue_count}/4
                    </p>

                    <p className="mt-1 text-sm text-gray-400">
                      {session.completed_at
                        ? "Completed"
                        : session.active
                          ? "In progress"
                          : "Inactive"}
                    </p>
                  </div>

                  {session.active && !session.completed_at && (
                    <button
                      disabled={busyId === session.id}
                      onClick={() => void resetSession(session)}
                      className="rounded-lg bg-red-800 px-4 py-2 font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      {busyId === session.id ? "Resetting..." : "Reset session"}
                    </button>
                  )}
                </div>
              </section>
            ))}

            {sessions.length === 0 && (
              <p className="text-gray-400">No sessions found.</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
