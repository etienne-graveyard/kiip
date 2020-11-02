import { SubscribeMethod, VoidSubscribeMethod } from 'suub';
export interface OnCallback {
  (arg: any): void;
}
export interface ResilientWebSocketOptions {
  autoJsonify?: boolean;
  autoConnect?: boolean;
  reconnectInterval?: number;
  reconnectOnError?: boolean;
}
export declare const DEFAULT_OPTIONS: Required<ResilientWebSocketOptions>;
export declare enum WebSocketEvent {
  CONNECTED = 'connected',
  MESSAGE = 'message',
  CONNECTING = 'connecting',
  CLOSE = 'close',
  ERROR = 'error',
}
export declare enum WebSocketState {
  Void = 'Void',
  Connecting = 'Connecting',
  Connected = 'Connected',
}
export interface WebSocketFactory {
  (url: string): WebSocket;
}
export interface ResilientWebSocket<T> {
  connect: () => WebSocket;
  send: (data: any) => void;
  close: () => void;
  getState: () => WebSocketState;
  onState: SubscribeMethod<WebSocketState>;
  on: {
    CONNECTED: VoidSubscribeMethod;
    MESSAGE: SubscribeMethod<T>;
    CONNECTING: VoidSubscribeMethod;
    CLOSE: SubscribeMethod<CloseEvent | undefined>;
    ERROR: VoidSubscribeMethod;
  };
}
export declare function createResilientWebSocket<T>(
  url: string,
  options: ResilientWebSocketOptions,
  wsFactory?: WebSocketFactory
): ResilientWebSocket<T>;
