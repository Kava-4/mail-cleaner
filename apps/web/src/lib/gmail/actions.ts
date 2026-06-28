import type { gmail_v1 } from "googleapis";
import type { SenderAction } from "@mail-cleaner/shared";

const BATCH_SIZE = 100;
const DELETE_BATCH = 1000;

export interface ActionRequest {
  action: SenderAction;
  messageIds: string[];
  senderEmail?: string;
  senderName?: string;
  dryRun?: boolean;
}

export interface ActionResult {
  dryRun: boolean;
  trashed: number;
  deleted: number;
  blocked: boolean;
  found: number;
  remaining: number;
  needsReauth: boolean;
  error?: string;
}

export interface EmptyFolderResult {
  found: number;
  deleted: number;
  dryRun: boolean;
  needsReauth: boolean;
  error?: string;
}

interface DeleteOutcome {
  deleted: number;
  failed: number;
  needsReauth: boolean;
  error?: string;
}

function quoteQuery(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/[\s"<>]/.test(trimmed)) return `"${trimmed.replace(/"/g, "")}"`;
  return trimmed;
}

function isPermissionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /403|insufficient|permission|scope/i.test(message);
}

export async function applySenderAction(
  gmail: gmail_v1.Gmail,
  request: ActionRequest,
): Promise<ActionResult> {
  if (request.action === "keep") {
    return {
      dryRun: !!request.dryRun,
      trashed: 0,
      deleted: 0,
      blocked: false,
      found: 0,
      remaining: 0,
      needsReauth: false,
    };
  }

  const trashIds = await collectTrashAndSpamIds(gmail, request);
  const inboxIds = await collectInboxIds(gmail, request);
  const found = new Set([...trashIds, ...inboxIds, ...request.messageIds]).size;

  if (found === 0) {
    return {
      dryRun: false,
      trashed: 0,
      deleted: 0,
      blocked: false,
      found: 0,
      remaining: 0,
      needsReauth: false,
    };
  }

  if (request.dryRun) {
    return {
      dryRun: true,
      trashed: inboxIds.length,
      deleted: trashIds.length,
      blocked: request.action === "delete_and_block",
      found,
      remaining: found,
      needsReauth: false,
    };
  }

  const purge = await permanentlyDeleteMessages(gmail, trashIds);
  const trashed = await trashMessages(gmail, inboxIds);

  let blocked = false;
  if (request.action === "delete_and_block" && request.senderEmail) {
    await createBlockFilter(gmail, request.senderEmail);
    blocked = true;
  }

  const remaining = await countRemaining(gmail, request);

  return {
    dryRun: false,
    trashed,
    deleted: purge.deleted,
    blocked,
    found,
    remaining,
    needsReauth: purge.needsReauth,
    error: purge.error,
  };
}

async function collectTrashAndSpamIds(
  gmail: gmail_v1.Gmail,
  request: ActionRequest,
): Promise<string[]> {
  const ids = new Set<string>();
  const queries: string[] = [];

  if (request.senderEmail?.includes("@")) {
    const email = quoteQuery(request.senderEmail);
    queries.push(`in:trash from:${email}`);
    queries.push(`in:spam from:${email}`);
  }

  if (request.senderName) {
    const name = quoteQuery(request.senderName);
    queries.push(`in:trash from:${name}`);
    queries.push(`in:trash ${name}`);
    queries.push(`in:spam ${name}`);
  }

  for (const query of queries) {
    for (const id of await collectAllMessageIds(gmail, query, 5000)) {
      ids.add(id);
    }
  }

  for (const id of request.messageIds) {
    const labels = await getMessageLabels(gmail, id);
    if (labels.includes("TRASH") || labels.includes("SPAM")) {
      ids.add(id);
    }
  }

  return [...ids];
}

async function collectInboxIds(
  gmail: gmail_v1.Gmail,
  request: ActionRequest,
): Promise<string[]> {
  const ids = new Set<string>();
  const queries: string[] = [];

  if (request.senderEmail?.includes("@")) {
    const email = quoteQuery(request.senderEmail);
    queries.push(`in:inbox from:${email}`);
  }

  if (request.senderName) {
    const name = quoteQuery(request.senderName);
    queries.push(`in:inbox from:${name}`);
  }

  for (const query of queries) {
    for (const id of await collectAllMessageIds(gmail, query, 5000)) {
      ids.add(id);
    }
  }

  for (const id of request.messageIds) {
    const labels = await getMessageLabels(gmail, id);
    if (!labels.includes("TRASH") && !labels.includes("SPAM")) {
      ids.add(id);
    }
  }

  return [...ids];
}

async function countRemaining(
  gmail: gmail_v1.Gmail,
  request: ActionRequest,
): Promise<number> {
  const trash = await collectTrashAndSpamIds(gmail, request);
  const inbox = await collectInboxIds(gmail, request);
  return new Set([...trash, ...inbox]).size;
}

async function getMessageLabels(
  gmail: gmail_v1.Gmail,
  id: string,
): Promise<string[]> {
  try {
    const message = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "minimal",
    });
    return message.data.labelIds ?? [];
  } catch {
    return [];
  }
}

export async function emptyFolder(
  gmail: gmail_v1.Gmail,
  folder: "inbox" | "spam" | "trash",
  dryRun = false,
): Promise<EmptyFolderResult> {
  const labelId = folder === "spam" ? "SPAM" : folder === "trash" ? "TRASH" : "INBOX";
  const ids = await collectMessagesByLabel(gmail, labelId);

  if (dryRun) {
    return { found: ids.length, deleted: 0, dryRun: true, needsReauth: false };
  }

  if (folder === "inbox") {
    const trashed = await trashMessages(gmail, ids);
    return {
      found: ids.length,
      deleted: trashed,
      dryRun: false,
      needsReauth: false,
    };
  }

  const outcome = await permanentlyDeleteMessages(gmail, ids);
  return {
    found: ids.length,
    deleted: outcome.deleted,
    dryRun: false,
    needsReauth: outcome.needsReauth,
    error: outcome.error,
  };
}

async function collectMessagesByLabel(
  gmail: gmail_v1.Gmail,
  labelId: string,
  max = 20000,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  while (ids.length < max) {
    const response = await gmail.users.messages.list({
      userId: "me",
      labelIds: [labelId],
      maxResults: Math.min(500, max - ids.length),
      pageToken,
    });

    for (const message of response.data.messages ?? []) {
      if (message.id) ids.push(message.id);
    }

    pageToken = response.data.nextPageToken ?? undefined;
    if (!pageToken) break;
  }

  return ids;
}

async function trashMessages(
  gmail: gmail_v1.Gmail,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;

  let processed = 0;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    await gmail.users.messages.batchModify({
      userId: "me",
      requestBody: {
        ids: chunk,
        addLabelIds: ["TRASH"],
        removeLabelIds: ["INBOX", "UNREAD"],
      },
    });
    processed += chunk.length;
  }

  return processed;
}

async function permanentlyDeleteMessages(
  gmail: gmail_v1.Gmail,
  ids: string[],
): Promise<DeleteOutcome> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    return { deleted: 0, failed: 0, needsReauth: false };
  }

  let deleted = 0;
  let failed = 0;
  let needsReauth = false;
  let error: string | undefined;

  for (let i = 0; i < unique.length; i += DELETE_BATCH) {
    const chunk = unique.slice(i, i + DELETE_BATCH);
    try {
      await gmail.users.messages.batchDelete({
        userId: "me",
        requestBody: { ids: chunk },
      });
      deleted += chunk.length;
    } catch (batchError) {
      if (isPermissionError(batchError)) {
        needsReauth = true;
        error =
          "Missing delete permission. Sign out, delete data/token.json, Connect Gmail again.";
        return { deleted, failed: unique.length - deleted, needsReauth, error };
      }

      for (const id of chunk) {
        try {
          await gmail.users.messages.delete({ userId: "me", id });
          deleted += 1;
        } catch (singleError) {
          failed += 1;
          if (isPermissionError(singleError)) {
            needsReauth = true;
            error =
              "Missing delete permission. Sign out, delete data/token.json, Connect Gmail again.";
          }
        }
      }
    }
  }

  return { deleted, failed, needsReauth, error };
}

async function collectAllMessageIds(
  gmail: gmail_v1.Gmail,
  query: string,
  max = 10000,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  while (ids.length < max) {
    const response = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: Math.min(500, max - ids.length),
      pageToken,
    });

    for (const message of response.data.messages ?? []) {
      if (message.id) ids.push(message.id);
    }

    pageToken = response.data.nextPageToken ?? undefined;
    if (!pageToken) break;
  }

  return ids;
}

async function createBlockFilter(
  gmail: gmail_v1.Gmail,
  senderEmail: string,
): Promise<void> {
  await gmail.users.settings.filters.create({
    userId: "me",
    requestBody: {
      criteria: { from: senderEmail },
      action: {
        removeLabelIds: ["INBOX"],
        addLabelIds: ["TRASH"],
      },
    },
  });
}

export async function markMessagesAsRead(
  gmail: gmail_v1.Gmail,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;

  let processed = 0;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    await gmail.users.messages.batchModify({
      userId: "me",
      requestBody: {
        ids: chunk,
        removeLabelIds: ["UNREAD"],
      },
    });
    processed += chunk.length;
  }

  return processed;
}

export async function markSpamAsRead(gmail: gmail_v1.Gmail): Promise<number> {
  const ids = await collectAllMessageIds(gmail, "in:spam is:unread", 5000);
  if (ids.length === 0) return 0;
  return markMessagesAsRead(gmail, ids);
}
