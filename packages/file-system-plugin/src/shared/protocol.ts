export const PLUGIN_ID = "file-system";

export type FileSystemProvider = "expo" | "rnfs" | "none";

export type FsEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number | null;
  modifiedAtMs?: number | null;
  mimeTypeHint?: string | null;
};

export type FsRoots = {
  provider: FileSystemProvider;
  roots: Array<{
    id: string;
    label: string;
    path: string;
  }>;
};

export type FileSystemEventMap = {
  // Sent by RN side when it initializes/reconnects - panel should re-fetch data
  "fs:ready": { timestamp: number };

  "fs:get-roots": { requestId: string };
  "fs:get-roots:result": { requestId: string } & FsRoots & { error?: string };

  "fs:list": { requestId: string; path: string };
  "fs:list:result": {
    requestId: string;
    provider: FileSystemProvider;
    path: string;
    entries: FsEntry[];
    error?: string;
  };

  "fs:read-image": {
    requestId: string;
    path: string;
    maxBytes?: number;
  };
  "fs:read-image:result": {
    requestId: string;
    provider: FileSystemProvider;
    path: string;
    dataUri?: string;
    error?: string;
  };

  "fs:read-file": {
    requestId: string;
    path: string;
    maxBytes?: number;
  };
  "fs:read-file:result": {
    requestId: string;
    provider: FileSystemProvider;
    path: string;
    content?: string;
    error?: string;
  };
};
