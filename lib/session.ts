import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";

export const COOKIE_NAME = "last_patient_session";
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 3,
  });
}
export async function getSessionToken() {
  return (await cookies()).get(COOKIE_NAME)?.value ?? null;
}
export const clueKey = (clue: number) =>
  createHmac("sha256", process.env.CLUE_SECRET ?? "")
    .update(`clue:${clue}`)
    .digest("base64url")
    .slice(0, 22);
export function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
