declare module 'expo-file-system' {
  export type FileInfo = {
    exists: boolean;
    isDirectory?: boolean;
    size?: number;
    modificationTime?: number; // seconds
    uri: string;
  };

  export const cacheDirectory: string | null;
  export const documentDirectory: string | null;
  export const bundleDirectory: string | null;

  export function readDirectoryAsync(uri: string): Promise<string[]>;
  export function getInfoAsync(
    uri: string,
    options?: { size?: boolean; md5?: boolean },
  ): Promise<FileInfo>;
  export function readAsStringAsync(
    uri: string,
    options?: { encoding?: 'base64' | 'utf8' },
  ): Promise<string>;
}

declare module 'react-native-fs' {
  export type ReadDirItem = {
    name: string;
    path: string;
    size: number;
    mtime?: Date;
    isFile: () => boolean;
    isDirectory: () => boolean;
  };

  export const MainBundlePath: string | undefined;
  export const CachesDirectoryPath: string;
  export const DocumentDirectoryPath: string;
  export const TemporaryDirectoryPath: string;
  export const LibraryDirectoryPath: string;

  export function readDir(path: string): Promise<ReadDirItem[]>;
  export function stat(path: string): Promise<{
    size: number;
    mtime?: Date;
    isFile: () => boolean;
    isDirectory: () => boolean;
  }>;
  export function readFile(
    path: string,
    encoding: 'base64' | 'utf8',
  ): Promise<string>;
}

declare module '@birdofpreyru/react-native-fs' {
  export * from 'react-native-fs';
}
declare module '@dr.pogodin/react-native-fs' {
  export * from 'react-native-fs';
}
