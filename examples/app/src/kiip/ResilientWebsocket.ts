import { Subscription, SubscribeMethod, VoidSubscribeMethod } from 'suub';

export interface OnCallback {
  (arg: any): void;
}

export interface ResilientWebSocketOptions {
  autoJsonify?: boolean;
  autoConnect?: boolean;
  reconnectInterval?: number;
  reconnectOnError?: boolean;
}

export const DEFAULT_OPTIONS: Required<ResilientWebSocketOptions> = {
  autoJsonify: false,
  autoConnect: true,
  reconnectInterval: 1000,
  reconnectOnError: true,
};

export enum WebSocketEvent {
  CONNECTED = 'connected',
  MESSAGE = 'message',
  CONNECTING = 'connecting',
  CLOSE = 'close',
  ERROR = 'error',
}

export enum WebSocketState {
  Void = 'Void',
  Connecting = 'Connecting',
  Connected = 'Connected',
}

export interface WebSocketFactory {
  (url: string): WebSocket;
}

const WebSocketFactory: WebSocketFactory = (url: string) => new WebSocket(url);

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

export function createResilientWebSocket<T>(
  url: string,
  options: ResilientWebSocketOptions = {},
  wsFactory: WebSocketFactory = WebSocketFactory
): ResilientWebSocket<T> {
  const subs = {
    CONNECTED: Subscription(),
    MESSAGE: Subscription<T>() as Subscription<T>,
    CONNECTING: Subscription(),
    CLOSE: Subscription() as Subscription<CloseEvent | undefined>,
    ERROR: Subscription(),
  };

  const stateSub = Subscription<WebSocketState>() as Subscription<WebSocketState>;
  let state: WebSocketState = WebSocketState.Void;

  const opts: Required<ResilientWebSocketOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  let socket: WebSocket | null = null;

  if (opts.autoConnect) {
    socket = connect();
  }

  const res: ResilientWebSocket<T> = {
    connect,
    send,
    close,
    getState,
    onState: stateSub.subscribe,
    on: {
      CONNECTED: subs.CONNECTED.subscribe,
      MESSAGE: subs.MESSAGE.subscribe,
      CONNECTING: subs.CONNECTING.subscribe,
      CLOSE: subs.CLOSE.subscribe,
      ERROR: subs.ERROR.subscribe,
    },
  };

  return res;

  function getState(): WebSocketState {
    return state;
  }

  function connect() {
    if (socket) {
      return socket;
    }
    socket = wsFactory(url);

    state = WebSocketState.Connecting;
    stateSub.emit(state);
    subs.CONNECTING.emit();
    socket.addEventListener('open', onOpen);
    socket.addEventListener('message', onMessage);
    socket.addEventListener('close', onClose);
    socket.addEventListener('error', onError);

    return socket;
  }

  function send(data: any) {
    if (socket) {
      socket.send(opts.autoJsonify ? JSON.stringify(data) : data);
    }
  }

  function close() {
    if (socket) {
      socket.close();
      subs.CLOSE.emit(undefined);
      cleanup();
    }
  }

  function cleanup() {
    if (socket) {
      socket.removeEventListener('error', onError);
      socket.removeEventListener('message', onMessage);
      socket.removeEventListener('open', onOpen);
      socket.removeEventListener('close', onClose);
      socket = null;
    }
  }

  function onOpen() {
    state = WebSocketState.Connected;
    subs.CONNECTED.emit();
    stateSub.emit(state);
  }

  function onMessage(event: MessageEvent) {
    const message: T = opts.autoJsonify ? JSON.parse(event.data) : event.data;
    subs.MESSAGE.emit(message);
  }

  function onClose(event?: CloseEvent) {
    cleanup();
    state = WebSocketState.Void;
    stateSub.emit(state);
    subs.CLOSE.emit(event);
    setTimeout(() => {
      socket = connect();
    }, opts.reconnectInterval);
  }

  function onError() {
    state = WebSocketState.Void;
    stateSub.emit(state);
    subs.ERROR.emit();
    if (opts.reconnectOnError) {
      onClose();
    }
  }
}
