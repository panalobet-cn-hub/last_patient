import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSessionToken, hashToken, safeEqual, clueKey } from "@/lib/session";

export const runtime = "nodejs";
export async function POST(req: Request) {
  const token = await getSessionToken();
  if (!token)
    return NextResponse.json(
      {
        error:
          "Identify yourself first by scanning START and selecting your profile.",
      },
      { status: 401 },
    );
  let body: { clue?: number; key?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const clue = Number(body.clue);
  if (!Number.isInteger(clue) || clue < 1 || clue > 4)
    return NextResponse.json({ error: "Unknown clue." }, { status: 400 });
  if (
    !process.env.CLUE_SECRET ||
    typeof body.key !== "string" ||
    !safeEqual(body.key, clueKey(clue))
  )
    return NextResponse.json(
      {
        error:
          "This clue can only be recorded by scanning its physical QR code.",
      },
      { status: 403 },
    );
  const { data: session, error: sessionError } = await supabase
    .from("game_sessions")
    .select("id,active,completed_at")
    .eq("session_token_hash", hashToken(token))
    .maybeSingle();
  if (sessionError)
    return NextResponse.json(
      { error: "Database unavailable." },
      { status: 503 },
    );
  if (!session || !session.active || session.completed_at)
    return NextResponse.json(
      { error: "This investigation is no longer active." },
      { status: 403 },
    );
  const { data, error } = await supabase.rpc("complete_clue", {
    p_session_id: session.id,
    p_clue_number: clue,
  });
  if (error)
    return NextResponse.json(
      { error: "Could not record this clue." },
      { status: 503 },
    );
  const result = data?.[0];
  const status = result?.outcome;
  if (status === "out_of_order")
    return NextResponse.json(
      {
        error: `Not yet. Complete Clue ${Number(result.completed_count) + 1} first.`,
        completedCount: result.completed_count,
      },
      { status: 409 },
    );
  if (status === "session_inactive")
    return NextResponse.json(
      { error: "This investigation is no longer active." },
      { status: 403 },
    );
  if (status === "invalid_clue")
    return NextResponse.json({ error: "Unknown clue." }, { status: 400 });
  return NextResponse.json({
    ok: true,
    alreadyComplete: status === "already_complete",
    completedCount: result.completed_count,
  });
}
