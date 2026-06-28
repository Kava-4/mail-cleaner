import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { getDataDir } from "./auth";

const WHITELIST_FILE = "whitelist.json";

export async function loadWhitelist(): Promise<string[]> {
  const filePath = path.join(getDataDir(), WHITELIST_FILE);
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveWhitelist(keys: string[]): Promise<void> {
  const dir = getDataDir();
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, WHITELIST_FILE);
  await writeFile(filePath, JSON.stringify([...new Set(keys)], null, 2));
}

export async function addToWhitelist(key: string): Promise<string[]> {
  const current = await loadWhitelist();
  if (!current.includes(key)) current.push(key);
  await saveWhitelist(current);
  return current;
}

export async function removeFromWhitelist(key: string): Promise<string[]> {
  const current = (await loadWhitelist()).filter((item) => item !== key);
  await saveWhitelist(current);
  return current;
}
