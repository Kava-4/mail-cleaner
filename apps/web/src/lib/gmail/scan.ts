import type { gmail_v1 } from "googleapis";
import {
  classifyClusters,
  parseFromHeader,
  senderKey,
  type ScanFolder,
  type ScanResult,
  type SenderGroup,
} from "@mail-cleaner/shared";

const FOLDER_QUERIES: Record<ScanFolder, string> = {
  inbox: "in:inbox",
  spam: "in:spam",
  trash: "in:trash",
};

const METADATA_HEADERS = ["From", "Subject", "List-Unsubscribe"];

interface ScanOptions {
  folders?: ScanFolder[];
  maxPerFolder?: number;
}

export async function scanMailboxes(
  gmail: gmail_v1.Gmail,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const folders = options.folders ?? ["spam", "trash", "inbox"];
  const maxPerFolder = options.maxPerFolder ?? 2000;
  const groups = new Map<string, SenderGroup>();
  const folderCounts: Record<ScanFolder, number> = {
    inbox: 0,
    spam: 0,
    trash: 0,
  };

  for (const folder of folders) {
    const messageIds = await listMessageIds(
      gmail,
      FOLDER_QUERIES[folder],
      maxPerFolder,
    );
    folderCounts[folder] = messageIds.length;

    const messages = await fetchMessageMetadata(gmail, messageIds);
    for (const message of messages) {
      mergeMessageIntoGroups(groups, message, folder);
    }
  }

  const senders = [...groups.values()].sort((a, b) => b.count - a.count);

  return {
    senders,
    totalMessages: senders.reduce((sum, sender) => sum + sender.count, 0),
    folderCounts,
  };
}

async function listMessageIds(
  gmail: gmail_v1.Gmail,
  query: string,
  maxResults: number,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  while (ids.length < maxResults) {
    const response = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: Math.min(500, maxResults - ids.length),
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

async function fetchMessageMetadata(
  gmail: gmail_v1.Gmail,
  ids: string[],
): Promise<gmail_v1.Schema$Message[]> {
  const batchSize = 25;
  const messages: gmail_v1.Schema$Message[] = [];

  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    const chunkResults = await Promise.all(
      chunk.map((id) =>
        gmail.users.messages.get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: METADATA_HEADERS,
        }),
      ),
    );
    messages.push(...chunkResults.map((result) => result.data));
  }

  return messages;
}

function mergeMessageIntoGroups(
  groups: Map<string, SenderGroup>,
  message: gmail_v1.Schema$Message,
  folder: ScanFolder,
): void {
  if (!message.id) return;

  const headers = message.payload?.headers ?? [];
  const from =
    headers.find((header) => header.name?.toLowerCase() === "from")?.value ??
    "unknown";
  const subject =
    headers.find((header) => header.name?.toLowerCase() === "subject")
      ?.value ?? "(no subject)";
  const unsubscribe = headers.some(
    (header) => header.name?.toLowerCase() === "list-unsubscribe",
  );
  const parsed = parseFromHeader(from);
  const key = senderKey(parsed.email, parsed.name);
  const snippet = message.snippet ?? "";
  const clusters = classifyClusters(subject, snippet, unsubscribe);
  const date = message.internalDate
    ? new Date(Number(message.internalDate)).toISOString()
    : new Date().toISOString();

  const existing = groups.get(key);
  if (!existing) {
    groups.set(key, {
      key,
      email: parsed.email,
      name: parsed.name,
      domain: parsed.domain,
      count: 1,
      folders: [folder],
      lastSubject: subject,
      lastDate: date,
      hasUnsubscribe: unsubscribe,
      clusters,
      messageIds: [message.id],
    });
    return;
  }

  existing.count += 1;
  if (!existing.folders.includes(folder)) {
    existing.folders.push(folder);
  }
  if (date > existing.lastDate) {
    existing.lastDate = date;
    existing.lastSubject = subject;
  }
  existing.hasUnsubscribe = existing.hasUnsubscribe || unsubscribe;
  existing.clusters = [...new Set([...existing.clusters, ...clusters])];
  existing.messageIds.push(message.id);
}

export async function getFolderCounts(
  gmail: gmail_v1.Gmail,
): Promise<Record<ScanFolder, number>> {
  const counts: Record<ScanFolder, number> = {
    inbox: 0,
    spam: 0,
    trash: 0,
  };

  for (const folder of Object.keys(FOLDER_QUERIES) as ScanFolder[]) {
    const response = await gmail.users.messages.list({
      userId: "me",
      q: FOLDER_QUERIES[folder],
      maxResults: 1,
    });
    counts[folder] = response.data.resultSizeEstimate ?? 0;
  }

  return counts;
}
