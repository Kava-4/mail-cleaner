import { NextRequest, NextResponse } from "next/server";
import { createOAuthClient, saveToken } from "@/lib/gmail/auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/?authError=${encodeURIComponent(error)}`, request.url),
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL("/?authError=missing_code", request.url));
  }

  try {
    const client = await createOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    await saveToken(client);
    return NextResponse.redirect(new URL("/?connected=1", request.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : "callback_failed";
    return NextResponse.redirect(
      new URL(`/?authError=${encodeURIComponent(message)}`, request.url),
    );
  }
}
