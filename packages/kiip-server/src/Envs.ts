import * as z from 'zod';
import * as dotenv from 'dotenv';
import * as path from 'path';

export const Envs = parseEnvs();

export type Envs = ReturnType<typeof parseEnvs>;

function parseEnvs() {
  const NODE_ENV = process.env.NODE_ENV;
  if (NODE_ENV !== 'development' && NODE_ENV !== 'production') {
    throw new Error('Invalid NODE_ENV !');
  }

  const envFiles = [`.env.${NODE_ENV}.local`, `.env.${NODE_ENV}`, '.env.local', '.env'];

  const allEnvs: any = {};
  envFiles.forEach((file) => {
    const res = dotenv.config({ path: path.resolve(__dirname, '../..', file) });
    if (res.parsed) {
      Object.assign(allEnvs, res.parsed);
    }
  });
  Object.assign(allEnvs, process.env);

  const parsed = z
    .object({
      NODE_ENV: z.literal('development').or(z.literal('production')),
      PORT: z.string(),
      POSTGRES_URI: z.string(),
      MAILGUN_API_PASSWORD: z.string(),
      MAILGUN_URL: z.string(),
      MAIL_TEST_MODE: z.literal('true').or(z.literal('false')),
      ALLOWED_APPS: z.string(),
      ALLOWED_EMAILS: z.string(),
    })
    .nonstrict()
    .parse(allEnvs);

  return {
    NODE_ENV: parsed.NODE_ENV,
    IS_DEV: parsed.NODE_ENV === 'development',
    PORT: parseInt(parsed.PORT || '', 10),
    POSTGRES_URI: parsed.POSTGRES_URI,
    MAILGUN_API_PASSWORD: parsed.MAILGUN_API_PASSWORD,
    MAIL_TEST_MODE: !!JSON.parse(parsed.MAIL_TEST_MODE || 'false'),
    MAILGUN_URL: parsed.MAILGUN_URL,
    ALLOWED_APPS: parsed.ALLOWED_APPS.split(/, ?/)
      .filter((v) => v.length > 0)
      .map((app) => new URL(app)),
    ALLOWED_EMAILS: parsed.ALLOWED_EMAILS.split(/, ?/).filter((v) => v.length > 0),
  };
}
