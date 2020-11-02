import { ContextStack, createContext, HttpError, Middleware } from '@tumau/core';
import { JsonParserConsumer } from '@tumau/json';
import * as z from 'zod';

export type ZodValidatorInstance<T> = {
  validate: Middleware;
  getValue: (ctx: ContextStack) => T;
};

export function ZodValidator<T>(schema: z.Schema<T>): ZodValidatorInstance<T> {
  const Ctx = createContext<T>();

  const validate: Middleware = async (ctx, next) => {
    const jsonBody = ctx.getOrFail(JsonParserConsumer);

    try {
      const result = schema.parse(jsonBody);
      return next(ctx.with(Ctx.Provider(result)));
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.errors.map((err) => `  ${err.path.join('.')}: ${err.message}`);
        throw new HttpError.BadRequest(`Schema validation failed: ${message}`);
      }
      throw error;
    }
  };

  return {
    validate,
    getValue: (ctx: ContextStack) => ctx.getOrFail(Ctx.Consumer),
  };
}
