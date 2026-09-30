# 0003: `/api/docs` serves OpenAPI JSON only

Status: accepted (F-01)

## Context

TD-005 says OpenAPI 3 is "served at /api/docs in non-production environments". A Swagger UI page needs an extra dependency that F-01 does not otherwise need.

## Decision

`GET /api/docs` returns the generated OpenAPI 3.1 JSON document (not wrapped in the envelope). It is mounted only when `NODE_ENV` is not `production`. Routes register themselves in the shared registry (`apps/api/src/lib/openapi.ts`); F-01 documents `/healthz` and the error envelope schema.

## Consequences

Developers can load the JSON into any viewer. A UI can be added later without changing the endpoint.
