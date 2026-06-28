import { NextResponse } from "next/server";
import { clearToken } from "@/lib/gmail/auth";

export async function POST() {
  await clearToken();
  return NextResponse.json({ ok: true });
}
