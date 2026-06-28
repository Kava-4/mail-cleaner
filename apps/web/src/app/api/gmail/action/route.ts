import { NextRequest, NextResponse } from "next/server";
import { getGmailService } from "@/lib/gmail/auth";
import {
  applySenderAction,
  emptyFolder,
  markMessagesAsRead,
  markSpamAsRead,
} from "@/lib/gmail/actions";
import { addToWhitelist } from "@/lib/gmail/whitelist";
import { unsubscribeFromMessage, massUnsubscribeFromMessages } from "@/lib/gmail/unsubscribe";
import { corsOptions, withCors } from "@/lib/cors";
import type { ScanFolder, SenderAction } from "@mail-cleaner/shared";

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

  const body = await request.json();

  try {
    if (body.type === "empty_folder") {
      const result = await emptyFolder(
        gmail,
        body.folder as ScanFolder,
        body.dryRun,
      );
      return withCors(NextResponse.json(result));
    }

    if (body.type === "mark_read") {
      const count = await markMessagesAsRead(gmail, body.messageIds as string[]);
      return withCors(NextResponse.json({ count }));
    }

    if (body.type === "mark_spam_read") {
      const count = await markSpamAsRead(gmail);
      return withCors(NextResponse.json({ count }));
    }

    if (body.type === "unsubscribe") {
      const result = await unsubscribeFromMessage(
        gmail,
        body.messageId as string,
      );
      return withCors(NextResponse.json(result));
    }

    if (body.type === "mass_unsubscribe") {
      const messageIds = body.messageIds as string[];
      const result = await massUnsubscribeFromMessages(gmail, messageIds);
      return withCors(NextResponse.json(result));
    }

    if (body.type === "sender") {
      const action = body.action as SenderAction;
      const senderKey = body.senderKey as string | undefined;

      if (action === "keep" && senderKey) {
        await addToWhitelist(senderKey);
        return withCors(
          NextResponse.json({
            kept: true,
            trashed: 0,
            deleted: 0,
            blocked: false,
          }),
        );
      }

      const result = await applySenderAction(gmail, {
        action,
        messageIds: body.messageIds as string[],
        senderEmail: body.senderEmail as string | undefined,
        senderName: body.senderName as string | undefined,
        dryRun: body.dryRun as boolean | undefined,
      });

      return withCors(NextResponse.json(result));
    }

    return withCors(
      NextResponse.json({ error: "Unknown action type" }, { status: 400 }),
    );
  } catch (error) {
    return withCors(
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Action failed" },
        { status: 500 },
      ),
    );
  }
}
