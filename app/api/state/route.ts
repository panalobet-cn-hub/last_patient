import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSessionToken, hashToken } from "@/lib/session";
export const runtime = "nodejs";
export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ session: null });
  const { data: session, error } = await supabase
    .from("game_sessions")
    .select(
      "id,employee_id,started_at,completed_at,is_winner,active,employees(id,name,photo_url)",
    )
    .eq("session_token_hash", hashToken(token))
    .maybeSingle();
  if (error)
    return NextResponse.json(
      { error: "Database unavailable." },
      { status: 503 },
    );
  if (!session) return NextResponse.json({ session: null });
  const { data: progress, error: progressError } = await supabase
    .from("clue_progress")
    .select("clue_number,completed_at")
    .eq("session_id", session.id)
    .order("clue_number");
  if (progressError)
    return NextResponse.json(
      { error: "Could not restore progress." },
      { status: 503 },
    );
  const { data: winner } = await supabase
    .from("game_winners")
    .select("session_id,employee_id,completed_at,employees(name,photo_url)")
    .eq("session_id", session.id)
    .maybeSingle();
  return NextResponse.json(
    { session, progress: progress ?? [], winner: winner ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
