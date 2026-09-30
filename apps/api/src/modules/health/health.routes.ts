import { healthResponseSchema } from '@edumetrics/shared';
import { Router } from 'express';
import { registry } from '../../lib/openapi.js';
import { health } from './health.controller.js';

registry.registerPath({
  method: 'get',
  path: '/healthz',
  summary: 'Liveness check',
  tags: ['health'],
  responses: {
    200: {
      description: 'The process is up',
      content: { 'application/json': { schema: healthResponseSchema } },
    },
  },
});

export const healthRouter = Router();

// Root-level, unversioned, liveness only (no dependency checks yet).
healthRouter.get('/healthz', health);
