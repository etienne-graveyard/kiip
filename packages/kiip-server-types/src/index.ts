import * as z from 'zod';

export const Access = z.enum(['Owner', 'Editor', 'Reader']);
export type Access = z.infer<typeof Access>;

export type AccessObject = { [email: string]: Access };

export type Documents = Array<{ id: string; title: string; access: AccessObject }>;

// Messages

// UP
export type RequestLoginEmail = z.infer<typeof RequestLoginEmail>;
export const RequestLoginEmail = z.object({
  type: z.literal('RequestLoginMail'),
  email: z.string().email(),
});

// DOWN
export type LoginEmailSend = {
  type: 'LoginEmailSend';
  loginId: string;
};

export type UnauthorizedEmail = {
  type: 'UnauthorizedEmail';
};

export type TooManyLogingAttempts = {
  type: 'TooManyLogingAttempts';
};

// UP
export type LoginCode = z.infer<typeof LoginCode>;
export const LoginCode = z.object({
  type: z.literal('LoginCode'),
  loginId: z.string(),
  code: z.string(),
});

// DOWN
export type LoggedIn = {
  type: 'LoggedIn';
  token: string;
  documents: Documents;
};

export type InvalidLoginCode = {
  type: 'InvalidLoginCode';
};

// UP
export type CreateDocument = z.infer<typeof CreateDocument>;
export const CreateDocument = z.object({
  type: z.literal('CreateDocument'),
  title: z.string(),
});

// DOWN
export type DocumentsUpdated = {
  type: 'DocumentsUpdated';
  documents: Documents;
};

// UP
export type SetAccess = z.infer<typeof SetAccess>;
export const SetAccess = z.object({
  type: z.literal('SetAccess'),
  documentId: z.string(),
  email: z.string().email(),
  access: Access.nullable(),
});

// DOWN
export type RequestError = {
  type: 'InternalError';
  error: string;
};

// UP
export type ValidateToken = z.infer<typeof ValidateToken>;
export const ValidateToken = z.object({
  type: z.literal('ValidateToken'),
  token: z.string(),
});

// DOWN
export type InvalidToken = {
  type: 'InvalidToken';
};

export type UpMessage = z.infer<typeof UpMessage>;
export const UpMessage = z.union([RequestLoginEmail, LoginCode, CreateDocument, SetAccess, ValidateToken]);

export type DownMessage =
  | LoginEmailSend
  | UnauthorizedEmail
  | TooManyLogingAttempts
  | LoggedIn
  | InvalidLoginCode
  | DocumentsUpdated
  | RequestError
  | InvalidToken;
