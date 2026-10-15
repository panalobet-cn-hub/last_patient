import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSessionToken, hashToken } from "@/lib/session";
export const runtime = "nodejs";
const attempts = new Map<string, { count: number; resetAt: number }>();
export async function POST(req: Request) {
  const token = await getSessionToken();
  if (!token)
    return NextResponse.json(
      { error: "Identify yourself before closing the case." },
      { status: 401 },
    );
  const key = hashToken(token);
  const now = Date.now();
  const record = attempts.get(key);
  if (record && record.resetAt > now && record.count >= 8)
    return NextResponse.json(
      { error: "Too many attempts. Wait a minute before trying again." },
      { status: 429 },
    );
  if (!record || record.resetAt <= now)
    attempts.set(key, { count: 1, resetAt: now + 60_000 });
  else record.count++;
  let suspect = "";
  try {
    const body = await req.json();
    suspect = typeof body.suspect === "string" ? body.suspect : "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const suspects = [
    "the-silent-doctor",
    "the-hollow-nurse",
    "the-faceless-patient",
    "the-night-attendant",
  ];
  if (!suspects.includes(suspect))
    return NextResponse.json(
      { error: "Choose one of the four suspected figures." },
      { status: 400 },
    );
  const { data: session, error } = await supabase
    .from("game_sessions")
    .select("id,active,completed_at")
    .eq("session_token_hash", hashToken(token))
    .maybeSingle();
  if (error)
    return NextResponse.json(
      { error: "Database unavailable." },
      { status: 503 },
    );
  if (!session || !session.active || session.completed_at)
    return NextResponse.json(
      { error: "This investigation is no longer active." },
      { status: 403 },
    );
  const { count, error: countError } = await supabase
    .from("clue_progress")
    .select("*", { count: "exact", head: true })
    .eq("session_id", session.id);
  if (countError)
    return NextResponse.json(
      { error: "Could not verify your evidence." },
      { status: 503 },
    );
  if (count !== 4)
    return NextResponse.json(
      { error: "Complete all four investigations first." },
      { status: 403 },
    );
  const { data, error: winnerError } = await supabase.rpc("claim_winner", {
    p_session_id: session.id,
  });
  if (winnerError)
    return NextResponse.json(
      { error: "Could not close the case. Try once more." },
      { status: 503 },
    );
  const result = data?.[0];
  if (result?.outcome === "already_won")
    return NextResponse.json({ outcome: "already_won" });
  if (result?.outcome !== "you_won")
    return NextResponse.json(
      { error: "This investigation is no longer eligible to win." },
      { status: 403 },
    );
  const { data: employee } = await supabase
    .from("employees")
    .select("name,photo_url")
    .eq("id", result.winner_employee_id)
    .single();
  return NextResponse.json({
    outcome: "you_won",
    employee,
    completedAt: result.finished_at,
  });
}
