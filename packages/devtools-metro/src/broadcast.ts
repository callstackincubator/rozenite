import WebSocket, { RawData, WebSocketServer } from 'ws';

export const getWebSocketBroadcastServer = (): WebSocketServer => {
  const wss = new WebSocketServer({
    port: 8888,
    perMessageDeflate: false,
  });

  const broadcast = (ws: WebSocket, message: RawData): void => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client !== ws) {
        client.send(message, { binary: false });
      }
    });
  };

  wss.on('connection', (ws) => {
    ws.on('message', (message, isBinary) => {
      if (isBinary) {
        return;
      }

      broadcast(ws, message);
    });
  });

  return wss;
};
