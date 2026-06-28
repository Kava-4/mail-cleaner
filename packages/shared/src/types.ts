export type ScanFolder = "inbox" | "spam" | "trash";

export type SenderAction = "delete_and_block" | "delete_only" | "keep";

export type SpamCluster = "gambling" | "adult" | "phishing" | "newsletter" | "other";

export interface ParsedSender {
  email: string;
  name: string;
  domain: string;
}

export interface SenderGroup {
  key: string;
  email: string;
  name: string;
  domain: string;
  count: number;
  folders: ScanFolder[];
  lastSubject: string;
  lastDate: string;
  hasUnsubscribe: boolean;
  clusters: SpamCluster[];
  messageIds: string[];
}

export interface ScanResult {
  senders: SenderGroup[];
  totalMessages: number;
  folderCounts: Record<ScanFolder, number>;
  folderEstimates?: Record<ScanFolder, number>;
}

export interface AuthStatus {
  authenticated: boolean;
  email?: string;
}

export interface FolderStats {
  spam: number;
  trash: number;
  inbox: number;
}
