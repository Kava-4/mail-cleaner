"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CLUSTER_LABELS,
  type ScanFolder,
  type ScanResult,
  type SenderAction,
  type SenderGroup,
  type SpamCluster,
} from "@mail-cleaner/shared";
import { SenderCard } from "./SenderCard";
import { ConnectPanel, GitHubLink, MissingCredentials } from "./ConnectPanel";
import { Button, ProgressBar, StatCard, Toast } from "./ui";

interface AuthState {
  authenticated: boolean;
  configured: boolean;
  email?: string;
}

type FolderFilter = ScanFolder | "all";

export default function Dashboard() {
  const [auth, setAuth] = useState<AuthState>({
    authenticated: false,
    configured: false,
  });
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clusterFilter, setClusterFilter] = useState<SpamCluster | "all">("all");
  const [folderFilter, setFolderFilter] = useState<FolderFilter>("all");
  const [search, setSearch] = useState("");
  const [hideKept, setHideKept] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ value: number; label: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const isScanning = busy === "scan";
  const isBusy = busy !== null;

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 6000);
  }, []);

  const loadAuth = useCallback(async () => {
    const response = await fetch("/api/auth/status");
    setAuth(await response.json());
  }, []);

  const loadWhitelist = useCallback(async () => {
    const response = await fetch("/api/gmail/whitelist");
    if (!response.ok) return;
    const data = await response.json();
    setWhitelist(data.whitelist ?? []);
  }, []);

  useEffect(() => {
    void loadAuth();
    void loadWhitelist();
  }, [loadAuth, loadWhitelist]);

  const filteredSenders = useMemo(() => {
    if (!scan) return [];
    let list = scan.senders;
    if (hideKept) list = list.filter((s) => !whitelist.includes(s.key));
    if (clusterFilter !== "all")
      list = list.filter((s) => s.clusters.includes(clusterFilter));
    if (folderFilter !== "all")
      list = list.filter((s) => s.folders.includes(folderFilter));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.lastSubject.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => b.count - a.count);
  }, [scan, whitelist, hideKept, clusterFilter, folderFilter, search]);

  async function signIn() {
    setBusy("signin");
    try {
      const response = await fetch("/api/auth/signin");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Sign-in failed");
      window.location.href = data.url;
    } catch (error) {
      notify(error instanceof Error ? error.message : "Sign-in failed");
    } finally {
      setBusy(null);
    }
  }

  async function runScan() {
    if (isScanning) return;
    setBusy("scan");
    setProgress({ value: 15, label: "Reading spam, trash, inbox..." });
    try {
      const response = await fetch("/api/gmail/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folders: ["spam", "trash", "inbox"], maxPerFolder: 2000 }),
      });
      setProgress({ value: 80, label: "Grouping senders..." });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Scan failed");
      setScan(data);
      setSelected(new Set());
      notify(`${data.senders.length} senders · ${data.totalMessages} messages`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Scan failed");
    } finally {
      setProgress(null);
      setBusy(null);
    }
  }

  async function emptyFolder(folder: ScanFolder) {
    const label = folder === "spam" ? "Spam" : "Trash";
    if (!window.confirm(`Permanently delete ALL emails in ${label}?`)) return;
    setBusy(`empty-${folder}`);
    setProgress({ value: 20, label: `Deleting ${label}...` });
    try {
      const response = await fetch("/api/gmail/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "empty_folder", folder }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed");

      if (data.needsReauth) {
        notify(
          "Re-login required: Sign out → delete data/token.json → Connect Gmail (delete permission)",
        );
      } else if (data.deleted === 0 && data.found > 0) {
        notify(`Failed: ${data.found} emails in ${label}, 0 deleted. Try signing in again.`);
      } else {
        notify(`Deleted ${data.deleted} / ${data.found} from ${label}`);
        await runScan();
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Failed");
    } finally {
      setProgress(null);
      setBusy(null);
    }
  }

  async function applyAction(action: SenderAction, senders: SenderGroup[]) {
    if (senders.length === 0) return;

    const total = senders.reduce((sum, s) => sum + s.count, 0);
    if (
      action !== "keep" &&
      !window.confirm(
        action === "delete_and_block"
          ? `Block + delete ${senders.length} sender(s), ~${total} emails;`
          : action === "delete_only"
            ? `Delete ${senders.length} sender(s), ~${total} emails; (Trash/Spam = permanent)`
            : `Keep ${senders.length} sender(s);`,
      )
    ) {
      return;
    }

    setBusy(action);
    let deleted = 0;
    let trashed = 0;
    let blocked = 0;
    let found = 0;
    const removedKeys: string[] = [];

    for (let i = 0; i < senders.length; i += 1) {
      const sender = senders[i];
      setProgress({
        value: ((i + 1) / senders.length) * 100,
        label: `${sender.name || sender.email} (${i + 1}/${senders.length})`,
      });

      const response = await fetch("/api/gmail/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "sender",
          action,
          messageIds: sender.messageIds,
          senderEmail: sender.email,
          senderName: sender.name,
          senderKey: sender.key,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        notify(data.error ?? "Action failed");
        break;
      }

      deleted += data.deleted ?? 0;
      trashed += data.trashed ?? 0;
      found += data.found ?? 0;
      if (data.blocked) blocked += 1;
      if (data.needsReauth) {
        notify(
          data.error ??
            "Re-login required: Sign out → delete data/token.json → Connect Gmail",
        );
        break;
      }

      const processed = (data.deleted ?? 0) + (data.trashed ?? 0);
      if (processed > 0 && (data.remaining ?? 0) === 0) {
        removedKeys.push(sender.key);
      } else if (processed > 0) {
        removedKeys.push(sender.key);
        notify(
          `${sender.name}: ${processed} processed, ${data.remaining} still remain in Gmail`,
        );
      }
    }

    if (action === "keep") {
      await loadWhitelist();
      notify(`Kept ${senders.length} sender(s)`);
    } else if (removedKeys.length > 0) {
      const keys = new Set(removedKeys);
      setScan((current) =>
        current
          ? {
              ...current,
              senders: current.senders.filter((s) => !keys.has(s.key)),
              totalMessages: current.senders
                .filter((s) => !keys.has(s.key))
                .reduce((sum, s) => sum + s.count, 0),
            }
          : current,
      );
      notify(
        `OK: ${deleted} deleted · ${trashed} to trash${blocked ? ` · ${blocked} blocked` : ""}`,
      );
    } else {
      notify(
        `Nothing deleted (found ${found}). Try Empty Trash or Block.`,
      );
    }

    setSelected(new Set());
    setProgress(null);
    setBusy(null);
  }

  async function massUnsubscribe(senders: SenderGroup[]) {
    const eligible = senders.filter((s) => s.hasUnsubscribe && s.messageIds[0]);
    if (eligible.length === 0) {
      notify("No senders with a List-Unsubscribe header found.");
      return;
    }

    if (
      !window.confirm(
        `Mass unsubscribe for ${eligible.length} sender(s)? This may take a few minutes.`,
      )
    ) {
      return;
    }

    setBusy("mass-unsub");
    try {
      const messageIds = eligible.map((s) => s.messageIds[0]);
      setProgress({ value: 10, label: `Unsubscribing ${eligible.length} lists...` });

      const response = await fetch("/api/gmail/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "mass_unsubscribe", messageIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Mass unsubscribe failed");

      setProgress({ value: 100, label: "Done" });
      notify(
        `Unsub: ${data.success} OK · ${data.failed} failed` +
          (data.mailto ? ` · ${data.mailto} mailto (manual)` : ""),
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Mass unsubscribe failed");
    } finally {
      setProgress(null);
      setBusy(null);
    }
  }

  async function unsubscribeSender(sender: SenderGroup) {
    const messageId = sender.messageIds[0];
    if (!messageId) return;
    setBusy("unsub");
    try {
      const response = await fetch("/api/gmail/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "unsubscribe", messageId }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.detail ?? "Unsubscribe failed");
      notify(`Unsubscribed: ${sender.name}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unsubscribe failed");
    } finally {
      setBusy(null);
    }
  }

  const selectedSenders = scan?.senders.filter((s) => selected.has(s.key)) ?? [];
  const unsubscribableSelected = selectedSenders.filter((s) => s.hasUnsubscribe);
  const unsubscribableVisible = filteredSenders.filter((s) => s.hasUnsubscribe);

  async function signOut() {
    setBusy("signout");
    await fetch("/api/auth/signout", { method: "POST" });
    setScan(null);
    setSelected(new Set());
    await loadAuth();
    setBusy(null);
  }

  return (
    <div className="min-h-screen">
      <header className="glass-strong sticky top-0 z-40 border-b-0 rounded-none border-x-0 border-t-0">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <img
              src="/icon.png"
              alt=""
              width={40}
              height={40}
              className="rounded-xl"
            />
            <div>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
              Mail Cleaner
            </p>
            <h1 className="text-xl font-semibold text-zinc-100">Inbox Cleanup</h1>
            </div>
          </div>
          {auth.authenticated ? (
            <div className="flex items-center gap-3 text-sm">
              <GitHubLink />
              <span className="hidden rounded-full border border-white/8 bg-black/30 px-3 py-1 text-zinc-400 backdrop-blur-sm md:inline">
                {auth.email}
              </span>
              <Button size="sm" variant="ghost" onClick={() => void signOut()}>
                Sign out
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <GitHubLink />
              <Button
                variant="primary"
                disabled={!auth.configured || isBusy}
                onClick={() => void signIn()}
              >
                Connect Gmail
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {!auth.configured ? <MissingCredentials /> : null}

        {auth.authenticated ? (
          <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
            <aside className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                <StatCard
                  label="Senders"
                  value={scan?.senders.length ?? "—"}
                  hint={scan ? `${scan.totalMessages} scanned` : undefined}
                />
                <StatCard label="Spam" value={scan?.folderCounts.spam ?? "—"} />
                <StatCard label="Trash" value={scan?.folderCounts.trash ?? "—"} />
                <StatCard label="Inbox" value={scan?.folderCounts.inbox ?? "—"} />
              </div>

              <div className="glass space-y-2 p-3">
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={isBusy}
                  onClick={() => void runScan()}
                >
                  {isScanning ? "Scanning..." : "Scan mailboxes"}
                </Button>
                <Button
                  variant="danger"
                  className="w-full"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => void emptyFolder("spam")}
                >
                  Empty Spam
                </Button>
                <Button
                  variant="danger"
                  className="w-full"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => void emptyFolder("trash")}
                >
                  Empty Trash
                </Button>
                {scan ? (
                  <>
                    <div className="my-1 border-t border-white/5" />
                    <Button
                      variant="accent"
                      className="w-full"
                      size="sm"
                      disabled={isBusy || unsubscribableVisible.length === 0}
                      onClick={() => void massUnsubscribe(unsubscribableVisible)}
                    >
                      Unsub all visible ({unsubscribableVisible.length})
                    </Button>
                  </>
                ) : null}
              </div>
            </aside>

            <section className="min-w-0 space-y-4">
              {!scan && !isScanning ? (
                <div className="glass flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
                  <img
                    src="/icon.png"
                    alt=""
                    width={64}
                    height={64}
                    className="mb-4 rounded-2xl opacity-90"
                  />
                  <h2 className="text-lg font-medium text-zinc-100">Start with a scan</h2>
                  <p className="mt-2 max-w-md text-sm text-zinc-500">
                    Review senders from Spam, Trash, and Inbox. Filter newsletters, mass
                    unsubscribe, or bulk delete.
                  </p>
                  <Button className="mt-5" variant="primary" onClick={() => void runScan()}>
                    Scan now
                  </Button>
                </div>
              ) : null}

              {isScanning && !scan ? (
                <div className="glass p-8 text-center text-sm text-zinc-500">
                  Scanning Gmail folders...
                </div>
              ) : null}

              {scan ? (
                <>
                  <div className="glass space-y-3 p-4">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <input
                        className="input xl:col-span-2"
                        placeholder="Search sender or subject..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      <select
                        className="input"
                        value={clusterFilter}
                        onChange={(e) =>
                          setClusterFilter(e.target.value as SpamCluster | "all")
                        }
                      >
                        <option value="all">All types</option>
                        {Object.entries(CLUSTER_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                      <select
                        className="input"
                        value={folderFilter}
                        onChange={(e) =>
                          setFolderFilter(e.target.value as FolderFilter)
                        }
                      >
                        <option value="all">All folders</option>
                        <option value="spam">Spam</option>
                        <option value="trash">Trash</option>
                        <option value="inbox">Inbox</option>
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(filteredSenders.map((s) => s.key)))}>
                        Select all ({filteredSenders.length})
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                        Clear
                      </Button>
                      <label className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
                        <input
                          type="checkbox"
                          checked={hideKept}
                          onChange={(e) => setHideKept(e.target.checked)}
                          className="accent-zinc-300"
                        />
                        Hide kept
                      </label>
                    </div>

                    <div className="flex flex-wrap gap-2 border-t border-white/5 pt-3">
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={selectedSenders.length === 0 || isBusy}
                        onClick={() => void applyAction("delete_and_block", selectedSenders)}
                      >
                        Block selected ({selectedSenders.length})
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={selectedSenders.length === 0 || isBusy}
                        onClick={() => void applyAction("delete_only", selectedSenders)}
                      >
                        Delete selected
                      </Button>
                      <Button
                        size="sm"
                        variant="subtle"
                        disabled={selectedSenders.length === 0 || isBusy}
                        onClick={() => void applyAction("keep", selectedSenders)}
                      >
                        Keep selected
                      </Button>
                      <Button
                        size="sm"
                        variant="accent"
                        disabled={unsubscribableSelected.length === 0 || isBusy}
                        onClick={() => void massUnsubscribe(unsubscribableSelected)}
                      >
                        Unsub selected ({unsubscribableSelected.length})
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {filteredSenders.map((sender) => (
                      <SenderCard
                        key={sender.key}
                        sender={sender}
                        selected={selected.has(sender.key)}
                        whitelisted={whitelist.includes(sender.key)}
                        onToggle={() =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(sender.key)) next.delete(sender.key);
                            else next.add(sender.key);
                            return next;
                          })
                        }
                        onAction={(action) => void applyAction(action, [sender])}
                        onUnsubscribe={() => void unsubscribeSender(sender)}
                        disabled={isBusy}
                      />
                    ))}
                    {filteredSenders.length === 0 ? (
                      <div className="glass p-8 text-center text-sm text-zinc-500">
                        No senders match filters.
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </section>
          </div>
        ) : auth.configured ? (
          <ConnectPanel disabled={isBusy} onConnect={() => void signIn()} />
        ) : null}
      </main>

      {toast ? <Toast message={toast} /> : null}
      {progress ? <ProgressBar value={progress.value} label={progress.label} /> : null}
    </div>
  );
}
