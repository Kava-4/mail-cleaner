import { NextRequest, NextResponse } from "next/server";
import { getGmailService } from "@/lib/gmail/auth";
import { getFolderCounts, scanMailboxes } from "@/lib/gmail/scan";
import { corsOptions, withCors } from "@/lib/cors";
import type { ScanFolder } from "@mail-cleaner/shared";

export async function OPTIONS() {
  return corsOptions();
}

export async function POST(request: NextRequest) {
  const gmail = await getGmailService();
  if (!gmail) {
    return withCors(
      NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    folders?: ScanFolder[];
    maxPerFolder?: number;
  };

  try {
    const [result, estimates] = await Promise.all([
      scanMailboxes(gmail, {
        folders: body.folders ?? ["spam", "trash", "inbox"],
        maxPerFolder: body.maxPerFolder ?? 2000,
      }),
      getFolderCounts(gmail),
    ]);

    return withCors(
      NextResponse.json({
        ...result,
        folderEstimates: estimates,
      }),
    );
  } catch (error) {
    return withCors(
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Scan failed" },
        { status: 500 },
      ),
    );
  }
}
