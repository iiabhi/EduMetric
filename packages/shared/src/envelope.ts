import { z } from './openapi.js';
import { errorCodeSchema } from './errors.js';

/** CONV-002 success envelope. */
export const successEnvelope = <T extends z.ZodType>(data: T) =>
  z.object({
    success: z.literal(true),
    data,
    meta: z.record(z.string(), z.unknown()).optional(),
  });

export const paginationMetaSchema = z.object({
  nextCursor: z.string().nullable(),
  limit: z.number().int().positive(),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

/** CONV-002 list envelope with meta.pagination. */
export const paginatedEnvelope = <T extends z.ZodType>(item: T) =>
  z.object({
    success: z.literal(true),
    data: z.array(item),
    meta: z.object({ pagination: paginationMetaSchema }),
  });

export const validationDetailSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export type ValidationDetail = z.infer<typeof validationDetailSchema>;

/** CONV-003 error envelope. `details` is present only for VALIDATION_ERROR. */
export const errorEnvelopeSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    details: z.array(validationDetailSchema).optional(),
    requestId: z.string(),
  }),
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
