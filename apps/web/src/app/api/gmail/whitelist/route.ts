import { NextResponse } from "next/server";
import {
  addToWhitelist,
  loadWhitelist,
  removeFromWhitelist,
} from "@/lib/gmail/whitelist";
import { getGmailService } from "@/lib/gmail/auth";

export async function GET() {
  const whitelist = await loadWhitelist();
  return NextResponse.json({ whitelist });
}

export async function POST(request: Request) {
  const gmail = await getGmailService();
  if (!gmail) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as {
    action: "add" | "remove";
    key: string;
  };

  const whitelist =
    body.action === "remove"
      ? await removeFromWhitelist(body.key)
      : await addToWhitelist(body.key);

  return NextResponse.json({ whitelist });
}
