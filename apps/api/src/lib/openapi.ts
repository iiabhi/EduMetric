import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { errorEnvelopeSchema } from '@edumetrics/shared';

export const registry = new OpenAPIRegistry();

registry.register('ErrorEnvelope', errorEnvelopeSchema);

export const buildOpenApiDocument = () =>
  new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: { title: 'EduMetrics API', version: '0.1.0' },
    servers: [{ url: '/' }],
  });
