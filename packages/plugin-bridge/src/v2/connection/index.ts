export { createHandshakeConnection } from './handshake-connection.js';
export { createBufferedConnection } from './buffered-connection.js';
export type {
  Connection,
  HandshakeConnectionConfig,
  BufferedConnectionConfig,
  TypedBufferConfig,
  UserMessage,
  WireMessage,
  HandshakeMessage,
  HandshakeMessageType,
  HandshakeStateType,
} from './types.js';
export {
  HANDSHAKE_INIT,
  HANDSHAKE_ACK,
  HANDSHAKE_COMPLETE,
  HandshakeState,
  isHandshakeMessage,
  isWireMessage,
} from './types.js';
