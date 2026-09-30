import { errorEnvelopeSchema, healthResponseSchema, readyResponseSchema } from '@edumetrics/shared';
import { Router } from 'express';
import type { Logger } from '../../lib/logger.js';
import { registry } from '../../lib/openapi.js';
import { createReadyz, health } from './health.controller.js';
import { createReadinessService, type ReadinessCheck } from './health.service.js';

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

registry.registerPath({
  method: 'get',
  path: '/readyz',
  summary: 'Readiness check (MySQL and Redis reachable)',
  tags: ['health'],
  responses: {
    200: {
      description: 'Dependencies are reachable',
      content: { 'application/json': { schema: readyResponseSchema } },
    },
    503: {
      description: 'A dependency is unreachable (SERVICE_UNAVAILABLE)',
      content: { 'application/json': { schema: errorEnvelopeSchema } },
    },
  },
});

export interface HealthRouterDeps {
  checks: ReadinessCheck[];
  logger: Logger;
}

// Root-level, unversioned. /healthz is liveness only; /readyz probes dependencies.
export const createHealthRouter = ({ checks, logger }: HealthRouterDeps): Router => {
  const router = Router();
  router.get('/healthz', health);
  router.get('/readyz', createReadyz(createReadinessService(checks), logger));
  return router;
};
