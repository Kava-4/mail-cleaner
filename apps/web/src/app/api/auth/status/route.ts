import { NextResponse } from "next/server";
import {
  getAuthenticatedClient,
  getUserEmail,
  hasCredentialsFile,
} from "@/lib/gmail/auth";
import { corsOptions, withCors } from "@/lib/cors";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET() {
  try {
    if (!hasCredentialsFile()) {
      return withCors(
        NextResponse.json({
          authenticated: false,
          configured: false,
        }),
      );
    }

    const client = await getAuthenticatedClient();
    if (!client) {
      return withCors(
        NextResponse.json({
          authenticated: false,
          configured: true,
        }),
      );
    }

    const email = await getUserEmail();
    return withCors(
      NextResponse.json({
        authenticated: true,
        configured: true,
        email,
      }),
    );
  } catch (error) {
    return withCors(
      NextResponse.json(
        {
          authenticated: false,
          configured: hasCredentialsFile(),
          error: error instanceof Error ? error.message : "Auth check failed",
        },
        { status: 500 },
      ),
    );
  }
}
