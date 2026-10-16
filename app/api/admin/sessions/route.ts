import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // TODO: Add your existing admin authentication check here.
    // Do not deploy this endpoint publicly without authentication.

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const { data: employees, error: employeeError } = await supabase
      .from("employees")
      .select("id, name, active")
      .order("name");

    if (employeeError) throw employeeError;

    const { data: sessions, error: sessionError } = await supabase
      .from("game_sessions")
      .select("id, employee_id, active, completed_at, started_at")
      .order("started_at", { ascending: false });

    if (sessionError) throw sessionError;

    const { data: progress, error: progressError } = await supabase
      .from("clue_progress")
      .select("session_id");

    if (progressError) throw progressError;

    const clueCounts = new Map<string, number>();

    for (const clue of progress ?? []) {
      clueCounts.set(
        clue.session_id,
        (clueCounts.get(clue.session_id) ?? 0) + 1,
      );
    }

    const employeeMap = new Map(
      (employees ?? []).map((employee) => [employee.id, employee]),
    );

    const result = (sessions ?? []).map((session) => ({
      id: session.id,
      employee_name:
        employeeMap.get(session.employee_id)?.name ?? "Unknown employee",
      active: session.active,
      completed_at: session.completed_at,
      started_at: session.started_at,
      clue_count: clueCounts.get(session.id) ?? 0,
    }));

    return NextResponse.json({ sessions: result });
  } catch (error) {
    console.error("Failed to load admin sessions:", error);

    return NextResponse.json(
      { error: "Failed to load sessions" },
      { status: 500 },
    );
  }
}
