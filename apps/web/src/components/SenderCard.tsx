import {
  CLUSTER_LABELS,
  type ScanFolder,
  type SenderAction,
  type SenderGroup,
  type SpamCluster,
} from "@mail-cleaner/shared";
import { Badge, Button } from "./ui";

const FOLDER_LABELS: Record<ScanFolder, string> = {
  inbox: "Inbox",
  spam: "Spam",
  trash: "Trash",
};

const FOLDER_CLASS: Record<ScanFolder, string> = {
  inbox: "folder-inbox",
  spam: "folder-spam",
  trash: "folder-trash",
};

const CLUSTER_CLASS: Record<SpamCluster, string> = {
  gambling: "cluster-gambling",
  adult: "cluster-adult",
  phishing: "cluster-phishing",
  newsletter: "cluster-newsletter",
  other: "cluster-other",
};

export function SenderCard({
  sender,
  selected,
  whitelisted,
  onToggle,
  onAction,
  onUnsubscribe,
  disabled,
}: {
  sender: SenderGroup;
  selected: boolean;
  whitelisted: boolean;
  onToggle: () => void;
  onAction: (action: SenderAction) => void;
  onUnsubscribe: () => void;
  disabled: boolean;
}) {
  const initial = (sender.name || sender.email || "?").charAt(0).toUpperCase();

  return (
    <div
      className={`glass flex flex-col gap-3 p-4 transition md:flex-row md:items-center ${
        selected ? "ring-1 ring-zinc-400/40" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-2 h-4 w-4 rounded border-white/15 bg-black/30 accent-zinc-300"
        />
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-black/30 text-sm font-semibold text-zinc-300 backdrop-blur-sm">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-medium text-zinc-100">{sender.name || sender.email}</h3>
            <Badge className="border border-white/8 bg-black/30 text-zinc-400">
              {sender.count}
            </Badge>
            {whitelisted ? (
              <Badge className="border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                Kept
              </Badge>
            ) : null}
            {sender.hasUnsubscribe ? (
              <Badge className="border border-zinc-400/20 bg-zinc-400/10 text-zinc-300">
                List
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-zinc-500">
            {sender.email || sender.domain}
          </p>
          <p className="mt-2 line-clamp-1 text-sm text-zinc-400">{sender.lastSubject}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sender.folders.map((folder) => (
              <Badge key={folder} className={FOLDER_CLASS[folder]}>
                {FOLDER_LABELS[folder]}
              </Badge>
            ))}
            {sender.clusters.slice(0, 3).map((cluster) => (
              <Badge key={cluster} className={CLUSTER_CLASS[cluster]}>
                {CLUSTER_LABELS[cluster]}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 md:justify-end">
        {sender.hasUnsubscribe ? (
          <Button size="sm" variant="accent" disabled={disabled} onClick={onUnsubscribe}>
            Unsub
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="danger"
          disabled={disabled || whitelisted}
          onClick={() => onAction("delete_and_block")}
        >
          Block
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled || whitelisted}
          onClick={() => onAction("delete_only")}
        >
          Delete
        </Button>
        <Button size="sm" variant="subtle" disabled={disabled} onClick={() => onAction("keep")}>
          Keep
        </Button>
      </div>
    </div>
  );
}
