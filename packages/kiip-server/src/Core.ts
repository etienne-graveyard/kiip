import {
  createServer,
  Middleware,
  HttpError,
  createContext,
  RequestConsumer,
  compose,
  TumauUpgradeResponse,
} from '@tumau/core';
import { Chemin, CheminParam } from 'chemin';
import { CorsPackage } from '@tumau/cors';
import { JsonPackage, JsonResponse } from '@tumau/json';
import { WebsocketConsumer, WebsocketProvider } from '@tumau/ws';
import { RouterPackage, Route, RouterConsumer } from '@tumau/router';
import { Envs } from './Envs';
import { Mailer } from './Mailer';
import * as z from 'zod';
import { Random } from './tools/Random';
import { ZodValidator } from './ZodValidator';
import { createEphemereBidimensionalMap } from './tools/EphemereBidimensionalMap';
import { WebsocketServer, ConnectionData } from './WebsocketServer';
import { Access, Database } from './Database';

const RequestLoginBodyValidator = ZodValidator(
  z.object({
    email: z.string().email(),
  })
);

const ValidateLoginBodyValidator = ZodValidator(
  z.object({
    email: z.string().email(),
    loginId: z.string(),
    loginCode: z.string(),
  })
);

const UpdateDocumentBodyValidator = ZodValidator(
  z.object({
    title: z.string(),
    access: z.record(Access),
  })
);

const ROUTES = {
  home: Chemin.create(),
  requestLogin: Chemin.create('request-login'),
  validateLogin: Chemin.create('validate-login'),
  createDocument: Chemin.create('create-document'),
  document: Chemin.create('document', CheminParam.string('docId')),
  documentConnect: Chemin.create('document', CheminParam.string('docId'), 'connect'),
};

export const HandleZodError: Middleware = async (ctx, next) => {
  try {
    const res = await next(ctx);
    return res;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(error);
      throw new HttpError.BadRequest(error.message);
    }
    throw error;
  }
};

type AuthState = null | { email: null; reason: string } | { email: string };

const AuthentContext = createContext<AuthState>(null);

const MAX_SIMULTANEOUS_LOGIN = 5;

export async function Core(): Promise<{ start: () => void }> {
  const loginCodeCache = createEphemereBidimensionalMap<string>({
    defaultTtl: 3 * 60, // 3 minutes
  });

  const mailer = new Mailer(Envs.MAILGUN_URL, Envs.MAILGUN_API_PASSWORD, Envs.MAIL_TEST_MODE);

  const websocketServer = WebsocketServer();

  const database = await Database.mount(Envs.POSTGRES_URI);

  const IsAuthenticated: Middleware = async (tools, next) => {
    const req = tools.get(RequestConsumer);

    const authState = await (async (): Promise<AuthState> => {
      if (!req.headers.authorization) {
        return { email: null, reason: 'Invalid authorization header' };
      }
      const parts = req.headers.authorization.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer' || parts[1].length === 0) {
        return { email: null, reason: 'Invalid authorization header' };
      }
      const token = parts[1];
      const user = await database.findUserByToken(token);
      if (!user) {
        return { email: null, reason: 'Invalid token' };
      }
      return { email: user.email };
    })();

    return next(tools.with(AuthentContext.Provider(authState)));
  };

  const server = createServer({
    debug: Envs.IS_DEV,
    handleErrors: false,
    handleServerUpgrade: true,
    mainMiddleware: compose(
      CorsPackage({
        allowOrigin: Envs.ALLOWED_APPS.map((url) => url.origin),
        allowHeaders: ['content-type'],
        allowCredentials: true,
      }),
      JsonPackage(),
      WebsocketProvider(websocketServer),
      RouterPackage([
        Route.GET(ROUTES.home, IsAuthenticated, (tools) => {
          const auth = tools.get(AuthentContext.Consumer);
          if (auth === null || auth.email === null) {
            return JsonResponse.withJson({ hello: true });
          }
          // TODO: return list of documents
          throw new HttpError.Internal(`TODO`);
        }),
        Route.POST(ROUTES.requestLogin, HandleZodError, RequestLoginBodyValidator.validate, async (tools) => {
          const { email } = RequestLoginBodyValidator.getValue(tools);
          if (Envs.ALLOWED_EMAILS.includes(email) === false) {
            throw new HttpError.Forbidden(`You are not allowed to login with this email`);
          }
          const count = loginCodeCache.count(email);
          if (count >= MAX_SIMULTANEOUS_LOGIN) {
            throw new HttpError.TooManyRequests(`Too many login attempts with the mail ${email}. Try again later`);
          }
          const loginId = Random.nanoid();
          const loginCode = Random.humanReadableToken();
          loginCodeCache.set(email, loginId, loginCode);
          await mailer.sendMail({
            to: email,
            subject: `Your login code`,
            text: `Your login code is ${loginCode}`,
            html: `Your login code is ${loginCode}`,
          });
          return JsonResponse.withJson({ loginId });
        }),
        Route.POST(ROUTES.validateLogin, HandleZodError, ValidateLoginBodyValidator.validate, async (tools) => {
          const { email, loginCode, loginId } = ValidateLoginBodyValidator.getValue(tools);
          const code = loginCodeCache.get(email, loginId);
          if (!code || code !== loginCode) {
            throw new HttpError.Unauthorized(`Invalid code`);
          }
          // TODO: find or create user with token
          const token = Random.nanoid();
          return JsonResponse.withJson({ token });
        }),
        Route.GET(ROUTES.document, IsAuthenticated, async (tools) => {
          const auth = tools.get(AuthentContext.Consumer);
          if (auth === null || auth.email === null) {
            throw new HttpError.Unauthorized(auth?.reason);
          }
          const router = tools.getOrFail(RouterConsumer);
          const { docId } = router.getOrFail(ROUTES.document);
          const access = await database.findUserAccess(auth.email, docId);
          if (access === null) {
            throw new HttpError.NotFound();
          }
          const document = await database.findDocument(docId);
          return JsonResponse.withJson(document);
        }),
        Route.POST(ROUTES.document, IsAuthenticated, UpdateDocumentBodyValidator.validate, async (tools) => {
          const auth = tools.get(AuthentContext.Consumer);
          if (auth === null || auth.email === null) {
            throw new HttpError.Unauthorized(auth?.reason);
          }
          const router = tools.getOrFail(RouterConsumer);
          const { docId } = router.getOrFail(ROUTES.document);
          const access = await database.findUserAccess(auth.email, docId);
          if (access === null) {
            throw new HttpError.NotFound();
          }
          if (access !== Access.Values.Owner) {
            throw new HttpError.Unauthorized(`Only owner can edit a document metadata`);
          }
          const updates = UpdateDocumentBodyValidator.getValue(tools);
          // TODO: make sure there is at least one owner
          const document = await database.updateDocument(docId, updates);
          return JsonResponse.withJson(document);
        }),
        Route.UPGRADE(ROUTES.documentConnect, IsAuthenticated, async (tools, next) => {
          const auth = tools.get(AuthentContext.Consumer);
          if (auth === null || auth.email === null) {
            throw new HttpError.Unauthorized(auth?.reason);
          }
          const router = tools.getOrFail(RouterConsumer);
          const { docId } = router.getOrFail(ROUTES.document);
          const access = await database.findUserAccess(auth.email, docId);
          if (access === null) {
            throw new HttpError.NotFound();
          }
          const request = tools.get(RequestConsumer);
          if (request.isUpgrade) {
            const wss = tools.get(WebsocketConsumer);
            if (!wss) {
              throw new HttpError.Internal(`Missing WebsocketProvider`);
            }
            return new TumauUpgradeResponse(async (req, socket, head) => {
              return new Promise((res) => {
                wss.handleUpgrade(req, socket as any, head, (ws) => {
                  const data: ConnectionData = { email: auth.email, docId };
                  wss.emit('connection', ws, data);
                  res();
                });
              });
            });
          }
          return next(tools);
        }),
        // SendLoginCode(auth),
        // ValidateLoginCode(auth),
        // SendSignupCode(auth),
        // ValidateSignupCode(auth),
        // Logout,
        // CheckAuthentication(database),
        // Connect(auth),
        Route.fallback(() => {
          throw new HttpError.NotFound();
        }),
      ])
    ),
  });

  function start() {
    server.listen(Envs.PORT, () => {
      console.info(`App started on http://localhost:${Envs.PORT} & ws://localhost:${Envs.PORT} `);
    });
  }

  return {
    start,
  };

  // const kiip = Kiip<any, Metadata>(database, {
  //   getInitialMetadata: () => ({ token: nanoid() }),
  // });
  // const server = TumauServer.create({
  //   handleErrors: true,
  //   mainMiddleware: Middleware.compose(
  //     CorsPackage(),
  //     JsonPackage(),
  //     InvalidResponseToHttpError,
  //     RouterPackage([
  //       Route.GET('', async () => {
  //         const doc = await kiip.getDocuments();
  //         return JsonResponse.withJson({ status: 'ok', documentsCount: doc.length });
  //       }),
  //       Route.POST(ROUTES.register, AddDataValidator.validate, async (ctx) => {
  //         const { documentId, password } = AddDataValidator.getValue(ctx);
  //         if (password !== adminPassword) {
  //           throw new HttpError.Unauthorized(`Invalid password`);
  //         }
  //         const doc = await kiip.getDocumentState(documentId);
  //         return JsonResponse.withJson({ token: doc.meta.token });
  //       }),
  //       Route.POST(ROUTES.sync, SyncDataValidator.validate, async (ctx) => {
  //         const request = ctx.getOrFail(RequestConsumer);
  //         const authorization = request.headers.authorization;
  //         if (!authorization) {
  //           throw new HttpError.Unauthorized(`Missing authorization header`);
  //         }
  //         const parts = authorization.split(' ');
  //         if (parts.length !== 2 && parts[0] !== 'Bearer') {
  //           throw new HttpError.Unauthorized(`Invalid authorization header`);
  //         }
  //         const token = parts[1];
  //         const docId = ctx.getOrFail(RouterConsumer).getOrFail(ROUTES.sync).docId;
  //         const docs = await kiip.getDocuments();
  //         const doc = docs.find((d) => d.id === docId);
  //         if (!doc) {
  //           throw new HttpError.NotFound();
  //         }
  //         if (doc.meta.token !== token) {
  //           throw new HttpError.Unauthorized(`Invalid token`);
  //         }
  //         const data = SyncDataValidator.getValue(ctx);
  //         const docInstance = await kiip.getDocumentStore(docId);
  //         const res = await docInstance.handleSync(data);
  //         return JsonResponse.withJson(res);
  //       }),
  //       Route.all(null, () => {
  //         throw new HttpError.NotFound();
  //       }),
  //     ])
  //   ),
  // });
  // return server;
}
