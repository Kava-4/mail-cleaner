import type { SpamCluster } from "./types";

const GAMBLING = /\b(bonus|deposit|free spins|casino|wager|jackpot|betting|fs\b|200%)/i;
const ADULT =
  /\b(naughty|fantas(y|ies)|flirt|passion|crush|intimate|lust|sultry|amorous|verified profile|private members)/i;
const PHISHING =
  /\b(package was delivered|verify your account|account suspended|unusual sign|confirm your identity)/i;
const EMOJI_DENSITY = /[\u{1F300}-\u{1FAFF}]/gu;

export function classifyClusters(
  subject: string,
  snippet: string,
  hasUnsubscribe: boolean,
): SpamCluster[] {
  const text = `${subject} ${snippet}`;
  const clusters: SpamCluster[] = [];

  if (GAMBLING.test(text)) clusters.push("gambling");
  if (ADULT.test(text) || emojiDensity(subject) >= 3) clusters.push("adult");
  if (PHISHING.test(text)) clusters.push("phishing");
  if (hasUnsubscribe) clusters.push("newsletter");
  if (clusters.length === 0) clusters.push("other");

  return clusters;
}

function emojiDensity(text: string): number {
  return text.match(EMOJI_DENSITY)?.length ?? 0;
}

export const CLUSTER_LABELS: Record<SpamCluster, string> = {
  gambling: "Gambling",
  adult: "Adult / Dating",
  phishing: "Phishing",
  newsletter: "Newsletter",
  other: "Other",
};
