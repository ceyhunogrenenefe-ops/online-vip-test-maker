import { NextResponse } from "next/server";
import { OTURUM_CEREZ } from "@/lib/oturum";

export async function POST() {
  const res = NextResponse.json({ tamam: true });
  res.cookies.set(OTURUM_CEREZ, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
