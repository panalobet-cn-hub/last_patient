import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    // IMPORTANT:
    // Replace this with your existing server-side admin
    // authentication before deploying this endpoint.
    // Do not leave the endpoint publicly accessible.

    const { sessionId } = await request.json();

    if (
      typeof sessionId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        sessionId,
      )
    ) {
      return NextResponse.json(
        { error: "Invalid session ID" },
        { status: 400 },
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await supabase.rpc("reset_employee_session", {
      p_session_id: sessionId,
    });

    if (error) {
      console.error("Session reset failed:", error.message);
      return NextResponse.json(
        { error: "Could not reset session" },
        { status: 500 },
      );
    }

    if (data !== "reset") {
      return NextResponse.json(
        {
          error:
            data === "winner_protected"
              ? "The winner cannot be reset."
              : "Session is already completed, inactive, or unavailable.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
