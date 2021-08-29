import { UpMessage, DownMessage, Documents } from '@kiip/server-types';
import { EffectCleanup, StateMachine } from 'stachine';
import { Database } from '../Database';
import { Mailer } from '../Mailer';
import { EphemereBidimensionalMap } from '../tools/EphemereBidimensionalMap';
import { TypedSocket } from '../TypedSocket';
import { Random } from '../tools/Random';
import { Envs } from '../Envs';

type States =
  | { type: 'Void' }
  | { type: 'SendingMail'; email: string }
  | { type: 'WaitingForLoginCode'; email: string; loginId: string }
  | { type: 'ValidatingToken'; token: string }
  | { type: 'ValidatingLoginCode'; email: string; loginId: string; code: string }
  | { type: 'LoggedIn'; token: string; documents: Documents };

type Events = never;

export type ClientMachine = StateMachine<States, Events>;

const MAX_SIMULTANEOUS_LOGIN = 5;

export function createClientMachine(
  socket: TypedSocket<UpMessage, DownMessage>,
  database: Database,
  mailer: Mailer,
  loginCodeCache: EphemereBidimensionalMap<string>
): ClientMachine {
  return new StateMachine<States, Events>({
    initialState: { type: 'Void' },
    // globalEffect: ({ emit }) => {
    //   return socket.onMessage((msg) => {
    //     emit(msg);
    //   });
    // },
    debug: true,
    config: {
      Void: {
        shortcuts: ['SendingMail', 'ValidatingToken'],
        effect: (_state, machine) => {
          return socket.onMessage({
            RequestLoginMail: (event) => {
              machine.shortcut({ type: 'SendingMail', email: event.email });
            },
            ValidateToken: (event) => {
              machine.shortcut({ type: 'ValidatingToken', token: event.token });
            },
          });
        },
      },
      SendingMail: {
        shortcuts: ['WaitingForLoginCode', 'Void'],
        effect: (state, machine) => {
          return withCancelled(async (isCanceled) => {
            if (Envs.ALLOWED_EMAILS.includes(state.email) === false) {
              socket.send({ type: 'UnauthorizedEmail' });
              machine.shortcut({ type: 'Void' });
              return;
            }
            const count = loginCodeCache.count(state.email);
            if (count >= MAX_SIMULTANEOUS_LOGIN) {
              socket.send({ type: 'TooManyLogingAttempts' });
              machine.shortcut({ type: 'Void' });
              return;
            }
            const loginId = Random.nanoid();
            const loginCode = Random.humanReadableToken();
            await new Promise((res) => setTimeout(res, 3000));
            await mailer.sendMail({
              to: state.email,
              subject: `Your login code`,
              text: `Your login code is ${loginCode}`,
              html: `Your login code is ${loginCode}`,
            });
            if (isCanceled()) return;
            loginCodeCache.set(state.email, loginId, loginCode);
            socket.send({ type: 'LoginEmailSend', loginId });
            machine.shortcut({ type: 'WaitingForLoginCode', email: state.email, loginId: loginId });
          });
        },
      },
      ValidatingToken: {
        shortcuts: ['LoggedIn', 'Void'],
        effect: (state, machine) => {
          return withCancelled(async (isCanceled) => {
            const user = await database.findUserByToken(state.token);
            if (isCanceled()) return;
            if (user === null) {
              socket.send({ type: 'InvalidToken' });
              machine.shortcut({ type: 'Void' });
              return;
            }
            const documents = await database.findUserDocuments(state.token);
            if (isCanceled()) return;
            socket.send({ type: 'LoggedIn', token: user.token, documents });
            machine.shortcut({ type: 'LoggedIn', token: state.token, documents });
          });
        },
      },
      WaitingForLoginCode: {
        shortcuts: ['ValidatingLoginCode'],
        effect: (state, machine) => {
          return socket.onMessage({
            LoginCode: ({ loginId, code }) => {
              machine.shortcut({ type: 'ValidatingLoginCode', email: state.email, loginId, code });
            },
          });
        },
      },
      ValidatingLoginCode: {
        shortcuts: ['WaitingForLoginCode', 'LoggedIn', 'Void'],
        effect: ({ email, loginId, code }, machine) => {
          const validCode = loginCodeCache.get(email, loginId) === code;
          if (validCode === false) {
            socket.send({ type: 'InvalidLoginCode' });
            machine.shortcut({ type: 'WaitingForLoginCode', email, loginId });
            return;
          }
          return withCancelled(async (isCanceled) => {
            const user = await database.findUserByEmail(email);
            if (isCanceled()) return;
            if (!user) {
              socket.send({ type: 'InternalError', error: 'User not found' });
              machine.shortcut({ type: 'Void' });
              return;
            }
            const documents = await database.findUserDocuments(user.token);
            if (isCanceled()) return;
            socket.send({ type: 'LoggedIn', token: user.token, documents });
            machine.shortcut({ type: 'LoggedIn', token: user.token, documents });
          });
        },
      },
    },
  });
}

// function cancellableAsync<T>(action: () => Promise<T>, onComplete: (val: T) => void): EffectCleanup {
//   let canceled = false;
//   Promise.resolve(action()).then((res) => {
//     if (canceled) {
//       return;
//     }
//     onComplete(res);
//   });
//   return () => {
//     canceled = true;
//   };
// }

function withCancelled<T>(action: (canceled: () => boolean) => Promise<T>): EffectCleanup {
  let canceled = false;
  action(() => canceled);
  return () => {
    canceled = true;
  };
}
