import { NextResponse } from "next/server";
import {
  createOAuthClient,
  getAuthUrl,
  hasCredentialsFile,
} from "@/lib/gmail/auth";

export async function GET() {
  try {
    if (!hasCredentialsFile()) {
      return NextResponse.json(
        {
          error:
            "Missing credentials. Add data/credentials.json or set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
        },
        { status: 400 },
      );
    }

    const client = await createOAuthClient();
    const url = getAuthUrl(client);
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sign-in failed" },
      { status: 500 },
    );
  }
}
