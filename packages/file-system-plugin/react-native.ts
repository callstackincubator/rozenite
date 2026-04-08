import type { FileSystemProvider, FsEntry } from './src/shared/protocol';
export type {
  CreateExpoFileSystemAdapterOptions,
  CreateRNFSAdapterOptions,
  FileSystemAdapter,
  FileSystemRoot,
  UseFileSystemDevToolsOptions,
} from './src/react-native/fileSystemProvider';

const createNoopFileSystemAdapter = (
  provider: Exclude<FileSystemProvider, 'none'>,
) => ({
  provider,
  getRoots: async () => [],
  listDir: async () => [],
  statPath: async (path: string): Promise<FsEntry> => ({
    name: path,
    path,
    isDirectory: false,
    size: null,
    modifiedAtMs: null,
    mimeTypeHint: null,
  }),
  readImageBase64: async () => ({
    mime: 'application/octet-stream',
    base64: '',
  }),
  readTextFile: async () => '',
});

export let createExpoFileSystemAdapter: typeof import('./src/react-native/fileSystemProvider').createExpoFileSystemAdapter;
export let createRNFSAdapter: typeof import('./src/react-native/fileSystemProvider').createRNFSAdapter;
export let useFileSystemDevTools: typeof import('./src/react-native/useFileSystemDevTools').useFileSystemDevTools;

const isWeb =
  typeof window !== 'undefined' && window.navigator.product !== 'ReactNative';
const isDev = process.env.NODE_ENV !== 'production';
const isServer = typeof window === 'undefined';

if (isDev && !isWeb && !isServer) {
  createExpoFileSystemAdapter =
    require('./src/react-native/fileSystemProvider').createExpoFileSystemAdapter;
  createRNFSAdapter =
    require('./src/react-native/fileSystemProvider').createRNFSAdapter;
  useFileSystemDevTools =
    require('./src/react-native/useFileSystemDevTools').useFileSystemDevTools;
} else {
  createExpoFileSystemAdapter = () => createNoopFileSystemAdapter('expo');
  createRNFSAdapter = () => createNoopFileSystemAdapter('rnfs');
  useFileSystemDevTools = () => null;
}
