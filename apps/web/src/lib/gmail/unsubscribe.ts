import type { gmail_v1 } from "googleapis";

const UNSUBSCRIBE_HEADERS = [
  "List-Unsubscribe",
  "List-Unsubscribe-Post",
] as const;

export interface UnsubscribeResult {
  success: boolean;
  method?: "one-click" | "url" | "mailto";
  detail?: string;
}

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
): string | undefined {
  return (
    headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())
      ?.value ?? undefined
  );
}

function parseAngleUrls(value: string): string[] {
  const matches = [...value.matchAll(/<([^>]+)>/g)];
  return matches.map((match) => match[1]).filter(Boolean);
}

export async function unsubscribeFromMessage(
  gmail: gmail_v1.Gmail,
  messageId: string,
): Promise<UnsubscribeResult> {
  const message = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "metadata",
    metadataHeaders: [...UNSUBSCRIBE_HEADERS],
  });

  const headers = message.data.payload?.headers;
  const listUnsubscribe = getHeader(headers, "List-Unsubscribe");
  const listUnsubscribePost = getHeader(headers, "List-Unsubscribe-Post");

  if (!listUnsubscribe) {
    return { success: false, detail: "No List-Unsubscribe header found" };
  }

  const urls = parseAngleUrls(listUnsubscribe);
  const httpsUrl = urls.find((url) => url.startsWith("http"));
  const mailtoUrl = urls.find((url) => url.startsWith("mailto:"));

  if (listUnsubscribePost?.includes("List-Unsubscribe=One-Click") && httpsUrl) {
    const response = await fetch(httpsUrl, {
      method: "POST",
      headers: {
        "List-Unsubscribe": "One-Click",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "List-Unsubscribe=One-Click",
    });

    if (response.ok) {
      return { success: true, method: "one-click" };
    }
  }

  if (httpsUrl) {
    const response = await fetch(httpsUrl, { method: "GET", redirect: "follow" });
    if (response.ok || response.status < 500) {
      return { success: true, method: "url", detail: httpsUrl };
    }
  }

  if (mailtoUrl) {
    return { success: true, method: "mailto", detail: mailtoUrl };
  }

  return { success: false, detail: "Could not unsubscribe automatically" };
}

export interface MassUnsubscribeResult {
  total: number;
  success: number;
  failed: number;
  mailto: number;
  details: Array<{ messageId: string; result: UnsubscribeResult }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function massUnsubscribeFromMessages(
  gmail: gmail_v1.Gmail,
  messageIds: string[],
): Promise<MassUnsubscribeResult> {
  const unique = [...new Set(messageIds.filter(Boolean))];
  let success = 0;
  let failed = 0;
  let mailto = 0;
  const details: MassUnsubscribeResult["details"] = [];

  for (let i = 0; i < unique.length; i += 1) {
    const messageId = unique[i];
    const result = await unsubscribeFromMessage(gmail, messageId);
    details.push({ messageId, result });

    if (result.success) {
      if (result.method === "mailto") {
        mailto += 1;
      } else {
        success += 1;
      }
    } else {
      failed += 1;
    }

    if (i < unique.length - 1) {
      await sleep(350);
    }
  }

  return { total: unique.length, success, failed, mailto, details };
}
