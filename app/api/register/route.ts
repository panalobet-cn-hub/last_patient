import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { supabase } from "@/lib/supabase";
import { hashToken, newToken, setSessionCookie } from "@/lib/session";

export const runtime = "nodejs";
export async function GET() {
  const { data, error } = await supabase
    .from("employees")
    .select("id,name,photo_url")
    .eq("active", true)
    .order("name");
  if (error)
    return NextResponse.json(
      { error: "Could not load investigator list." },
      { status: 503 },
    );
  return NextResponse.json(
    { employees: data ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const employeeId =
      typeof body.employeeId === "string" ? body.employeeId : "";
    if (!/^[0-9a-f-]{36}$/i.test(employeeId))
      return NextResponse.json(
        { error: "Choose a valid employee profile." },
        { status: 400 },
      );
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id,name")
      .eq("id", employeeId)
      .eq("active", true)
      .maybeSingle();
    if (employeeError || !employee)
      return NextResponse.json(
        { error: "That profile is unavailable." },
        { status: 404 },
      );

    // Resume an existing attempt rather than silently resetting it. Recovery code is only shown once.
    const { data: existing } = await supabase
      .from("game_sessions")
      .select("id,started_at,completed_at")
      .eq("employee_id", employeeId)
      .eq("active", true)
      .is("completed_at", null)
      .maybeSingle();
    if (existing)
      return NextResponse.json(
        {
          error:
            "An investigation for this profile is already active. Use RESUME MY INVESTIGATION with its recovery code.",
        },
        { status: 409 },
      );

    const sessionToken = newToken();
    const rawRecovery = randomBytes(12).toString("hex").toUpperCase();
    const recoveryCode = `${rawRecovery.slice(0, 8)}-${rawRecovery.slice(8, 16)}-${rawRecovery.slice(16, 24)}`;
    const { data: session, error } = await supabase
      .from("game_sessions")
      .insert({
        employee_id: employeeId,
        session_token_hash: hashToken(sessionToken),
        recovery_code_hash: hashToken(recoveryCode),
      })
      .select("id,started_at")
      .single();
    if (error || !session)
      return NextResponse.json(
        {
          error:
            "Could not start the investigation. If you already started, resume it instead.",
        },
        { status: 503 },
      );
    await setSessionCookie(sessionToken);
    return NextResponse.json({
      sessionId: session.id,
      startedAt: session.started_at,
      recoveryCode,
      employee,
    });
  } catch {
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 },
    );
  }
}
