/**
 * A tiny in-memory `LynxTransport`, driven entirely by the test — no
 * DebugRouter, no `ws`, no real I/O. This is the whole point of
 * `LynxTransport` being a narrow interface (see its doc comment in
 * `../../types.ts`): every test in this directory drives `src/server/`
 * through this fake instead of the real transport.
 */
import { vi } from 'vitest';
import type { DeviceFrame, LynxClient, LynxSession, LynxTransport } from '../../types.js';

export type SentCdpMessage = {
  clientId: number;
  sessionId: number;
  message: unknown;
};

export class FakeLynxTransport implements LynxTransport {
  private clients: LynxClient[] = [];
  private readonly sessions = new Map<number, LynxSession[]>();
  private readonly frameListeners = new Set<(frame: DeviceFrame) => void>();
  private readonly topologyListeners = new Set<() => void>();
  readonly sentMessages: SentCdpMessage[] = [];
  readonly dispose = vi.fn(async (): Promise<void> => {});

  setClients(clients: LynxClient[]): void {
    this.clients = clients;
  }

  setSessions(clientId: number, sessions: LynxSession[]): void {
    this.sessions.set(clientId, sessions);
  }

  emitTopologyChanged(): void {
    for (const listener of this.topologyListeners) {
      listener();
    }
  }

  emitDeviceFrame(frame: DeviceFrame): void {
    for (const listener of this.frameListeners) {
      listener(frame);
    }
  }

  listClients(): LynxClient[] {
    return this.clients;
  }

  listSessions(clientId: number): LynxSession[] {
    return this.sessions.get(clientId) ?? [];
  }

  sendCdpMessage(clientId: number, sessionId: number, message: unknown): void {
    this.sentMessages.push({ clientId, sessionId, message });
  }

  onDeviceFrame(listener: (frame: DeviceFrame) => void): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  onTopologyChanged(listener: () => void): () => void {
    this.topologyListeners.add(listener);
    return () => this.topologyListeners.delete(listener);
  }
}

export const makeClient = (overrides: Partial<LynxClient> = {}): LynxClient => ({
  clientId: 1,
  deviceId: 'device-serial-1',
  appName: 'com.example.app',
  deviceName: 'Pixel 7',
  os: 'Android',
  sdkVersion: '3.2.1',
  ...overrides,
});
