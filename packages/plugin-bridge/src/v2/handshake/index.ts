export { createHandshakeLayer } from './handshake-layer.js';
export type { HandshakeLayer, QueuedMessage, UserMessage } from './handshake-layer.js';
export {
  HANDSHAKE_INIT,
  HANDSHAKE_ACK,
  HANDSHAKE_COMPLETE,
  HandshakeState,
} from './types.js';
export type { HandshakeMessage, HandshakeMessageType } from './types.js';
export { isHandshakeMessage } from './types.js';
