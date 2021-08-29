import { Envs } from './Envs';
import * as Websocket from 'ws';
import { Database } from './Database';
import { createEphemereBidimensionalMap } from './tools/EphemereBidimensionalMap';
import { Mailer } from './Mailer';
import { createClientMachine } from './machines/ClientMachine';
import { TypedSocket } from './TypedSocket';
import { DownMessage, UpMessage } from '@kiip/server-types';

const THREE_MINUTES_IN_SECONDS = 3 * 60;

export async function Core(): Promise<{ start: () => void }> {
  // const ID_LENGTH = 10;
  // const TS = Timestamp.withConfig({ idLength: ID_LENGTH });
  // const K = new Kiip({ Timestamp: TS });

  const loginCodeCache = createEphemereBidimensionalMap<string>({ defaultTtl: THREE_MINUTES_IN_SECONDS });
  const mailer = new Mailer(Envs.MAILGUN_URL, Envs.MAILGUN_API_PASSWORD, Envs.MAIL_TEST_MODE);

  const database = await Database.mount(Envs.POSTGRES_URI);

  function start() {
    const wss = new Websocket.Server({ port: Envs.PORT });

    wss.on('connection', (ws) => {
      const socket = new TypedSocket<UpMessage, DownMessage>(ws, UpMessage);
      createClientMachine(socket, database, mailer, loginCodeCache);
    });

    wss.on('listening', () => {
      console.log(`Server is listning on ws://localhost:${Envs.PORT}`);
    });
  }

  return {
    start,
  };

  // const IsAuthenticated: Middleware = async (tools, next) => {
  //   const req = tools.get(RequestConsumer);

  //   const authState = await (async (): Promise<AuthState> => {
  //     if (!req.headers.authorization) {
  //       return { email: null, reason: 'Invalid authorization header' };
  //     }
  //     const parts = req.headers.authorization.split(' ');
  //     if (parts.length !== 2 || parts[0] !== 'Bearer' || parts[1].length === 0) {
  //       return { email: null, reason: 'Invalid authorization header' };
  //     }
  //     const token = parts[1];
  //     const user = await database.findUserByToken(token);
  //     if (!user) {
  //       return { email: null, reason: 'Invalid token' };
  //     }
  //     return { email: user.email, token: user.token };
  //   })();

  //   return next(tools.with(AuthentContext.Provider(authState)));
  // };

  // const server = createServer({
  //   debug: Envs.IS_DEV,
  //   handleErrors: true,
  //   handleServerUpgrade: true,
  //   mainMiddleware: compose(
  //     CorsPackage({
  //       allowOrigin: Envs.ALLOWED_APPS.map((url) => url.origin),
  //       allowHeaders: ['content-type', 'authorization'],
  //       allowCredentials: true,
  //     }),
  //     JsonParser(),
  //     WebsocketProvider(websocketServer),
  //     RouterPackage([
  //       Route.GET(ROUTES.home, IsAuthenticated, async (tools) => {
  //         const auth = tools.get(AuthentContext.Consumer);
  //         if (auth === null || auth.email === null) {
  //           return JsonResponse.withJson({ hello: true });
  //         }
  //         // TODO: return list of documents
  //         // throw new HttpError.Internal(`TODO`);
  //         const docs = await database.findUserDocuments(auth.token);
  //         return JsonResponse.withJson(docs);
  //       }),
  //       Route.POST(ROUTES.requestLogin, HandleZodError, RequestLoginBodyValidator.validate, async (tools) => {
  //         const { email } = RequestLoginBodyValidator.getValue(tools);
  //         if (Envs.ALLOWED_EMAILS.includes(email) === false) {
  //           throw new HttpError.Forbidden(`You are not allowed to login with this email`);
  //         }
  //         const count = loginCodeCache.count(email);
  //         if (count >= MAX_SIMULTANEOUS_LOGIN) {
  //           throw new HttpError.TooManyRequests(`Too many login attempts with the mail ${email}. Try again later`);
  //         }
  //         const loginId = Random.nanoid();
  //         const loginCode = Random.humanReadableToken();
  //         loginCodeCache.set(email, loginId, loginCode);
  //         await mailer.sendMail({
  //           to: email,
  //           subject: `Your login code`,
  //           text: `Your login code is ${loginCode}`,
  //           html: `Your login code is ${loginCode}`,
  //         });
  //         return JsonResponse.withJson({ loginId });
  //       }),
  //       Route.POST(ROUTES.validateLogin, HandleZodError, ValidateLoginBodyValidator.validate, async (tools) => {
  //         const { email, loginCode, loginId } = ValidateLoginBodyValidator.getValue(tools);
  //         const code = loginCodeCache.get(email, loginId);
  //         if (!code || code !== loginCode) {
  //           throw new HttpError.Unauthorized(`Invalid code`);
  //         }
  //         const user = await database.findUserByEmail(email);
  //         if (user) {
  //           return JsonResponse.withJson({ token: user.token });
  //         }
  //         const token = Random.nanoid();
  //         await database.insertUser(email, token);
  //         return JsonResponse.withJson({ token });
  //       }),
  //       Route.GET(ROUTES.document, IsAuthenticated, async (tools) => {
  //         const auth = tools.get(AuthentContext.Consumer);
  //         if (auth === null || auth.email === null) {
  //           throw new HttpError.Unauthorized(auth?.reason);
  //         }
  //         const router = tools.getOrFail(RouterConsumer);
  //         const { docId } = router.getOrFail(ROUTES.document);
  //         const document = await database.findDocument(docId);
  //         const access = document.access[auth.email];
  //         if (!access) {
  //           throw new HttpError.NotFound();
  //         }
  //         return JsonResponse.withJson(document);
  //       }),
  //       Route.POST(ROUTES.createDocument, IsAuthenticated, CreateDocumentBodyValidator.validate, async (tools) => {
  //         const auth = tools.get(AuthentContext.Consumer);
  //         if (auth === null || auth.email === null) {
  //           throw new HttpError.Unauthorized(auth?.reason);
  //         }
  //         const { title } = CreateDocumentBodyValidator.getValue(tools);
  //         const docId = Random.nanoid(ID_LENGTH);
  //         const initState = K.create(docId);
  //         await database.insertDocument(docId, title, auth.email, initState.clock.toString(), initState.tree);
  //         return JsonResponse.noContent();
  //       }),
  //       Route.POST(ROUTES.document, IsAuthenticated, UpdateDocumentBodyValidator.validate, async (tools) => {
  //         const auth = tools.get(AuthentContext.Consumer);
  //         if (auth === null || auth.email === null) {
  //           throw new HttpError.Unauthorized(auth?.reason);
  //         }
  //         const router = tools.getOrFail(RouterConsumer);
  //         const { docId } = router.getOrFail(ROUTES.document);
  //         const access = await database.findUserAccess(auth.email, docId);
  //         if (access === null) {
  //           throw new HttpError.NotFound();
  //         }
  //         if (access !== Access.Values.Owner) {
  //           throw new HttpError.Unauthorized(`Only owner can edit a document metadata`);
  //         }
  //         const updates = UpdateDocumentBodyValidator.getValue(tools);
  //         const document = await database.updateDocument(docId, updates);
  //         return JsonResponse.withJson(document);
  //       }),
  //       Route.UPGRADE(ROUTES.documentConnect, IsAuthenticated, async (tools, next) => {
  //         const auth = tools.get(AuthentContext.Consumer);
  //         if (auth === null || auth.email === null) {
  //           throw new HttpError.Unauthorized(auth?.reason);
  //         }
  //         const router = tools.getOrFail(RouterConsumer);
  //         const { docId } = router.getOrFail(ROUTES.document);
  //         const access = await database.findUserAccess(auth.email, docId);
  //         if (access === null) {
  //           throw new HttpError.NotFound();
  //         }
  //         const request = tools.get(RequestConsumer);
  //         if (request.isUpgrade) {
  //           const wss = tools.get(WebsocketConsumer);
  //           if (!wss) {
  //             throw new HttpError.Internal(`Missing WebsocketProvider`);
  //           }
  //           return new TumauUpgradeResponse(async (req, socket, head) => {
  //             return new Promise((res) => {
  //               wss.handleUpgrade(req, socket as any, head, (ws) => {
  //                 const data: ConnectionData = { email: auth.email, docId };
  //                 wss.emit('connection', ws, data);
  //                 res();
  //               });
  //             });
  //           });
  //         }
  //         return next(tools);
  //       }),
  //       Route.fallback(() => {
  //         throw new HttpError.NotFound();
  //       }),
  //     ])
  //   ),
  // });
}

// import { Mailer } from './Mailer';
// import * as z from 'zod';
// import { Random } from './tools/Random';
// import { ZodValidator } from './ZodValidator';
// import { createEphemereBidimensionalMap } from './tools/EphemereBidimensionalMap';
// import { Kiip, Timestamp } from '@kiip/core';

// const RequestLoginBodyValidator = ZodValidator(
//   z.object({
//     email: z.string().email(),
//   })
// );

// const ValidateLoginBodyValidator = ZodValidator(
//   z.object({
//     email: z.string().email(),
//     loginId: z.string(),
//     loginCode: z.string(),
//   })
// );

// const UpdateDocumentBodyValidator = ZodValidator(
//   z.object({
//     title: z.string(),
//     access: z.record(Access),
//   })
// );

// const CreateDocumentBodyValidator = ZodValidator(
//   z.object({
//     title: z.string(),
//   })
// );

// export const HandleZodError: Middleware = async (ctx, next) => {
//   try {
//     const res = await next(ctx);
//     return res;
//   } catch (error) {
//     if (error instanceof z.ZodError) {
//       console.error(error);
//       throw new HttpError.BadRequest(error.message);
//     }
//     throw error;
//   }
// };

// type AuthState = null | { email: null; reason: string } | { email: string; token: string };
