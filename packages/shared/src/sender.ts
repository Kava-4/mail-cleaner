import type { ParsedSender } from "./types";

const EMAIL_IN_ANGLE = /<([^>]+)>/;
const EMAIL_PLAIN = /[\w.+-]+@[\w.-]+\.\w+/;

export function parseFromHeader(from: string): ParsedSender {
  const trimmed = from.trim();
  const angleMatch = trimmed.match(EMAIL_IN_ANGLE);
  const email = (angleMatch?.[1] ?? trimmed.match(EMAIL_PLAIN)?.[0] ?? trimmed)
    .toLowerCase()
    .trim();
  const name = angleMatch
    ? trimmed.replace(EMAIL_IN_ANGLE, "").replace(/"/g, "").trim()
    : email.split("@")[0];
  const domain = email.includes("@") ? email.split("@")[1] : "";

  return { email, name: name || email, domain };
}

export function senderKey(email: string, name: string): string {
  return email || name.toLowerCase();
}
