import type { RequestHandler } from 'express';
import { z } from 'zod';
import { ValidationError } from '../lib/errors.js';

type Shape = z.ZodObject;

interface ValidateSchemas {
  body?: Shape;
  query?: Shape;
  params?: Shape;
}

const MAX_MESSAGE_LENGTH = 200;

/**
 * Validate body, query and params with Zod (CONV-007). Every schema is made strict, so unknown
 * keys are rejected. Parsed values are stored on `req.validated`; `req.query` is read-only in Express 5.
 */
export const validate = (schemas: ValidateSchemas): RequestHandler => {
  const strict = {
    body: schemas.body && z.strictObject(schemas.body.shape),
    query: schemas.query && z.strictObject(schemas.query.shape),
    params: schemas.params && z.strictObject(schemas.params.shape),
  };

  return (req, _res, next) => {
    const details: { path: string; message: string }[] = [];

    const check = (
      schema: z.ZodType | undefined,
      value: unknown,
      store: (data: unknown) => void,
    ) => {
      if (!schema) return;
      const result = schema.safeParse(value);
      if (result.success) {
        store(result.data);
        return;
      }
      for (const issue of result.error.issues) {
        details.push({
          path: issue.path.join('.'),
          message: issue.message.slice(0, MAX_MESSAGE_LENGTH),
        });
      }
    };

    check(strict.body, req.body, (data) => {
      req.validated.body = data;
    });
    check(strict.query, req.query, (data) => {
      req.validated.query = data;
    });
    check(strict.params, req.params, (data) => {
      req.validated.params = data;
    });

    if (details.length > 0) {
      next(new ValidationError(details));
      return;
    }
    next();
  };
};
