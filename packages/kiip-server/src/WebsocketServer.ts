import * as Websocket from 'ws';

export type ConnectionData = {
  email: string;
  docId: string;
};

export function WebsocketServer(): Websocket.Server {
  const wss = new Websocket.Server({ noServer: true });

  wss.on('connection', (ws, info: ConnectionData) => {
    console.log({ ws, info });
    console.log('TODO');
  });

  return wss;
}
