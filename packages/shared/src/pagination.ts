import { z } from './openapi.js';

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;
export const MAX_CURSOR_LENGTH = 512;

/** Query params shared by every list endpoint (CONV-006). */
export const paginationQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
    cursor: z
      .string()
      .min(1)
      .max(MAX_CURSOR_LENGTH)
      .regex(/^[A-Za-z0-9_-]+$/, 'Invalid cursor')
      .optional(),
  })
  .strict();

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
