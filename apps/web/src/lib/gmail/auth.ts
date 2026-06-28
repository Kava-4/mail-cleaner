import { existsSync } from "fs";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { google } from "googleapis";

export type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export const GMAIL_SCOPES = [
  "https://mail.google.com/",
  "https://www.googleapis.com/auth/gmail.settings.basic",
];

const DEFAULT_REDIRECT = "http://localhost:3000/api/auth/callback";

export function getDataDir(): string {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;

  const candidates = [
    path.join(process.cwd(), "data"),
    path.join(process.cwd(), "..", "..", "data"),
  ];

  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }

  return candidates[0];
}

export async function ensureDataDir(): Promise<string> {
  const dir = getDataDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

interface OAuthSecrets {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

async function loadOAuthSecrets(): Promise<OAuthSecrets> {
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ?? DEFAULT_REDIRECT;

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri,
    };
  }

  const dataDir = await ensureDataDir();
  const credPath = path.join(dataDir, "credentials.json");
  const raw = await readFile(credPath, "utf-8");
  const parsed = JSON.parse(raw) as {
    installed?: {
      client_id: string;
      client_secret: string;
      redirect_uris?: string[];
    };
    web?: {
      client_id: string;
      client_secret: string;
      redirect_uris?: string[];
    };
  };

  const block = parsed.web ?? parsed.installed;
  if (!block) {
    throw new Error("Invalid credentials.json format");
  }

  return {
    clientId: block.client_id,
    clientSecret: block.client_secret,
    redirectUri: block.redirect_uris?.[0] ?? redirectUri,
  };
}

export async function createOAuthClient(): Promise<OAuth2Client> {
  const secrets = await loadOAuthSecrets();
  const client = new google.auth.OAuth2(
    secrets.clientId,
    secrets.clientSecret,
    secrets.redirectUri,
  );

  const dataDir = await ensureDataDir();
  const tokenPath = path.join(dataDir, "token.json");

  try {
    const tokenRaw = await readFile(tokenPath, "utf-8");
    client.setCredentials(JSON.parse(tokenRaw));
  } catch {
    // not signed in yet
  }

  return client;
}

export async function saveToken(client: OAuth2Client): Promise<void> {
  const dataDir = await ensureDataDir();
  const tokenPath = path.join(dataDir, "token.json");
  await writeFile(tokenPath, JSON.stringify(client.credentials, null, 2));
}

export async function clearToken(): Promise<void> {
  const tokenPath = path.join(getDataDir(), "token.json");
  try {
    await unlink(tokenPath);
  } catch {
    // ignore missing token
  }
}

export async function getAuthenticatedClient(): Promise<OAuth2Client | null> {
  const client = await createOAuthClient();
  const creds = client.credentials;

  if (!creds.access_token && !creds.refresh_token) {
    return null;
  }

  if (
    creds.expiry_date &&
    creds.expiry_date <= Date.now() &&
    creds.refresh_token
  ) {
    const { credentials } = await client.refreshAccessToken();
    client.setCredentials(credentials);
    await saveToken(client);
  }

  return client;
}

export function getAuthUrl(client: OAuth2Client): string {
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
  });
}

export async function getGmailService() {
  const auth = await getAuthenticatedClient();
  if (!auth) return null;
  return google.gmail({ version: "v1", auth });
}

export async function getUserEmail(): Promise<string | undefined> {
  const auth = await getAuthenticatedClient();
  if (!auth) return undefined;

  const gmail = google.gmail({ version: "v1", auth });
  const profile = await gmail.users.getProfile({ userId: "me" });
  return profile.data.emailAddress ?? undefined;
}

export function hasCredentialsFile(): boolean {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return true;
  }
  return existsSync(path.join(getDataDir(), "credentials.json"));
}
