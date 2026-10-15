import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { safeEqual, clueKey } from "@/lib/session";

export const runtime = "nodejs";
export async function POST(req: Request) {
  const { password, stage } = await req.json().catch(() => ({}));
  const expected = process.env.QR_ADMIN_PASSWORD ?? "";
  if (
    !expected ||
    typeof password !== "string" ||
    !safeEqual(password, expected)
  )
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const stages: Record<string, string> = {
    "1": "/?clue=1",
    "2": "/?clue=2",
    "3": "/?clue=3",
    "4": "/?clue=4",
  };
  if (typeof stage !== "string" || !stages[stage])
    return NextResponse.json({ error: "Unknown QR stage." }, { status: 400 });
  if (!process.env.CLUE_SECRET)
    return NextResponse.json(
      { error: "Set CLUE_SECRET first." },
      { status: 400 },
    );
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  if (!base)
    return NextResponse.json(
      { error: "Set NEXT_PUBLIC_SITE_URL before generating QR codes." },
      { status: 400 },
    );
  try {
    const parsed = new URL(base);
    if (
      process.env.NODE_ENV === "production" &&
      ["localhost", "127.0.0.1"].includes(parsed.hostname)
    )
      return NextResponse.json(
        {
          error:
            "Set NEXT_PUBLIC_SITE_URL to the deployed production URL before printing.",
        },
        { status: 400 },
      );
  } catch {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SITE_URL must be a valid URL." },
      { status: 400 },
    );
  }
  const png = await QRCode.toBuffer(
    `${base.replace(/\/$/, "")}${stages[stage]}&k=${clueKey(Number(stage))}`,
    {
      type: "png",
      width: 900,
      margin: 3,
      errorCorrectionLevel: "H",
      color: { dark: "#111111", light: "#ffffff" },
    },
  );
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="last-patient-clue-${stage}.png"`,
      "Cache-Control": "no-store",
    },
  });
}
