import fs from 'node:fs';
import { getAgentDaemonTransport } from './daemon-paths.js';
import { getAgentGlobalRegistryPath, type DaemonTransport } from './daemon-paths.js';
import type { DaemonInfo } from './daemon-protocol.js';

export type RegisteredDaemonInfo = DaemonInfo & {
  metadataPath: string;
  lastSeenAt: number;
};

type RegistryPayload = {
  daemons: RegisteredDaemonInfo[];
};

const readRegistryPayload = (): RegistryPayload => {
  const registryPath = getAgentGlobalRegistryPath();

  try {
    const parsed = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as RegistryPayload;
    return {
      daemons: Array.isArray(parsed.daemons) ? parsed.daemons : [],
    };
  } catch {
    return { daemons: [] };
  }
};

const writeRegistryPayload = (payload: RegistryPayload): void => {
  fs.writeFileSync(getAgentGlobalRegistryPath(), JSON.stringify(payload, null, 2), 'utf8');
};

const matchesTransport = (
  entry: RegisteredDaemonInfo,
  transport: DaemonTransport,
): boolean => {
  return (
    entry.transportKind === transport.kind &&
    entry.address === transport.address &&
    entry.metadataPath === transport.metadataPath
  );
};

export const readRegisteredDaemons = (): RegisteredDaemonInfo[] => {
  return readRegistryPayload().daemons;
};

export const writeRegisteredDaemons = (daemons: RegisteredDaemonInfo[]): void => {
  writeRegistryPayload({ daemons });
};

export const registerDaemon = (info: DaemonInfo): RegisteredDaemonInfo => {
  const transport = getAgentDaemonTransport(info.workspace);
  const entry: RegisteredDaemonInfo = {
    ...info,
    metadataPath: transport.metadataPath,
    lastSeenAt: Date.now(),
  };
  const existing = readRegisteredDaemons().filter((candidate) => !matchesTransport(candidate, transport));
  existing.push(entry);
  writeRegisteredDaemons(existing);
  return entry;
};

export const touchRegisteredDaemon = (info: DaemonInfo): RegisteredDaemonInfo => {
  return registerDaemon(info);
};

export const unregisterDaemon = (workspace: string): void => {
  const transport = getAgentDaemonTransport(workspace);
  const retained = readRegisteredDaemons().filter((candidate) => !matchesTransport(candidate, transport));
  writeRegisteredDaemons(retained);
};
