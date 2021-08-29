import Websocket, { Data } from 'ws';
import { Database } from './Database';
import { DownMessage, UpMessage } from '@kiip/server-types';
import { Envs } from './Envs';
import { EphemereBidimensionalMap } from './tools/EphemereBidimensionalMap';
import { Random } from './tools/Random';
import { Mailer } from './Mailer';
import { ClientMachine, createClientMachine } from './machines/ClientMachine';

const MAX_SIMULTANEOUS_LOGIN = 5;

export class Client {
  private readonly machine: ClientMachine;
  private readonly database: Database;
  private readonly mailer: Mailer;
  private readonly loginCodeCache: EphemereBidimensionalMap<string>;
  private readonly ws: Websocket;

  constructor(ws: Websocket, database: Database, loginCodeCache: EphemereBidimensionalMap<string>, mailer: Mailer) {
    console.log('create client');
    this.machine = createClientMachine();
    this.database = database;
    this.ws = ws;
    this.loginCodeCache = loginCodeCache;
    this.mailer = mailer;
    ws.on('message', this.onUnknowMessage);
    console.log(typeof this.database);
  }

  private send(msg: DownMessage) {
    this.ws.send(JSON.stringify(msg));
  }

  private async onMessage(msg: UpMessage) {
    if (msg.type === 'RequestLoginMail') {
      if (Envs.ALLOWED_EMAILS.includes(msg.email) === false) {
        this.send({ type: 'UnauthorizedEmail', requestId: msg.requestId });
        return;
      }
      const count = this.loginCodeCache.count(msg.email);
      if (count >= MAX_SIMULTANEOUS_LOGIN) {
        this.send({ type: 'TooManyLogingAttempts', requestId: msg.requestId });
        return;
      }
      const loginId = Random.nanoid();
      const loginCode = Random.humanReadableToken();
      this.loginCodeCache.set(msg.email, loginId, loginCode);
      await this.mailer.sendMail({
        to: msg.email,
        subject: `Your login code`,
        text: `Your login code is ${loginCode}`,
        html: `Your login code is ${loginCode}`,
      });
      await new Promise((res) => setTimeout(res, 5000));
      this.send({ type: 'LoginEmailSend', requestId: msg.requestId });
      return;
    }
    if (msg.type === 'LoginCode') {
      // const code = this.loginCodeCache.get(email, loginId);
      // if (!code || code !== loginCode) {
      //   throw new HttpError.Unauthorized(`Invalid code`);
      // }
      // const user = await database.findUserByEmail(email);
      // if (user) {
      //   return JsonResponse.withJson({ token: user.token });
      // }
      // const token = Random.nanoid();
      // await database.insertUser(email, token);
      // return JsonResponse.withJson({ token });
    }
  }

  private onUnknowMessage = (data: Data) => {
    if (typeof data !== 'string') {
      console.error('Received non string data');
      return;
    }
    try {
      const parsed = UpMessage.parse(JSON.parse(data));
      this.onMessage(parsed);
      return;
    } catch (error) {
      console.log(data);
      console.error(error);
    }
  };
}
