import { Button } from "./ui";
import { GITHUB_URL } from "@/lib/site";

export function ConnectPanel({ onConnect, disabled }: { onConnect: () => void; disabled: boolean }) {
  return (
    <div className="glass-strong mx-auto max-w-lg p-8 text-center">
      <img
        src="/icon.png"
        alt="Mail Cleaner"
        width={64}
        height={64}
        className="mx-auto mb-4 rounded-2xl"
      />
      <h2 className="text-lg font-medium text-zinc-100">Connect Gmail</h2>
      <p className="mt-2 text-sm text-zinc-500">
        Local app · zero cloud · you own your data.
      </p>
      <Button className="mt-5" variant="primary" disabled={disabled} onClick={onConnect}>
        Connect Gmail
      </Button>
    </div>
  );
}

export function MissingCredentials() {
  return (
    <div className="glass-strong mb-6 p-5 text-sm text-zinc-400">
      <p className="font-medium text-zinc-200">OAuth not configured</p>
      <p className="mt-2">
        Save your Google OAuth JSON as{" "}
        <code className="rounded bg-black/40 px-1.5 py-0.5 text-zinc-300">
          data/credentials.json
        </code>{" "}
        and follow the setup guide in the{" "}
        <a
          className="text-zinc-200 underline decoration-zinc-600 underline-offset-2"
          href={`${GITHUB_URL}#google-oauth-setup`}
          target="_blank"
          rel="noreferrer"
        >
          README on GitHub
        </a>
        .
      </p>
    </div>
  );
}

export function GitHubLink({ className = "" }: { className?: string }) {
  return (
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.07] backdrop-blur-sm ${className}`}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
      GitHub
    </a>
  );
}
