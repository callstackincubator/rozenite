// Handshake protocol message types and constants

export const HANDSHAKE_INIT = '__HANDSHAKE_INIT__';
export const HANDSHAKE_ACK = '__HANDSHAKE_ACK__';
export const HANDSHAKE_COMPLETE = '__HANDSHAKE_COMPLETE__';

export type HandshakeMessageType =
  | typeof HANDSHAKE_INIT
  | typeof HANDSHAKE_ACK
  | typeof HANDSHAKE_COMPLETE;

export type HandshakeMessage = {
  type: HandshakeMessageType;
  pluginId: string;
};

export function isHandshakeMessage(message: unknown): message is HandshakeMessage {
  if (typeof message !== 'object' || message === null) {
    return false;
  }

  const msg = message as Record<string, unknown>;
  if (typeof msg.type !== 'string' || typeof msg.pluginId !== 'string') {
    return false;
  }

  return (
    msg.type === HANDSHAKE_INIT ||
    msg.type === HANDSHAKE_ACK ||
    msg.type === HANDSHAKE_COMPLETE
  );
}

export enum HandshakeState {
  NOT_STARTED = 'not_started',
  WAITING_FOR_ACK = 'waiting_for_ack',
  WAITING_FOR_COMPLETE = 'waiting_for_complete',
  READY = 'ready',
}
