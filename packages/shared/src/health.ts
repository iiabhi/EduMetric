import { successEnvelope } from './envelope.js';
import { z } from './openapi.js';

export const healthDataSchema = z.object({ status: z.literal('ok') }).openapi('HealthData');

export const healthResponseSchema = successEnvelope(healthDataSchema).openapi('HealthResponse');

export type HealthResponse = z.infer<typeof healthResponseSchema>;
