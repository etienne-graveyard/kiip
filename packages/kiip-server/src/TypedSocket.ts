import Websocket, { Data } from 'ws';
import { Subscription } from 'suub';
import * as z from 'zod';

export type UnionBase = { type: string };

export type TypedSocketHandler<UpMessage extends UnionBase> = {
  [K in UpMessage['type']]?: (message: Extract<UpMessage, { type: K }>) => void;
};

export class TypedSocket<UpMessage extends UnionBase, DownMessage> {
  private readonly ws: Websocket;
  private readonly upMessageParse: z.Schema<UpMessage>;

  private readonly messageSub = Subscription<UpMessage>() as Subscription<UpMessage>;

  constructor(ws: Websocket, upMessageParse: z.Schema<UpMessage>) {
    this.ws = ws;
    this.upMessageParse = upMessageParse;
    ws.on('message', this.onUnknowMessage);
  }

  onAnyMessage = this.messageSub.subscribe;

  onMessage = (handlers: TypedSocketHandler<UpMessage>) => {
    return this.onAnyMessage((msg) => {
      const handler = handlers[msg.type as UpMessage['type']];
      if (handler) {
        handler(msg as any);
      }
    });
  };

  send(msg: DownMessage) {
    this.ws.send(JSON.stringify(msg));
  }

  private onUnknowMessage = (data: Data) => {
    if (typeof data !== 'string') {
      console.error('Received non string data');
      return;
    }
    try {
      const parsed = this.upMessageParse.parse(JSON.parse(data));
      this.messageSub.emit(parsed);
      return;
    } catch (error) {
      console.log(data);
      console.error(error);
    }
  };
}
