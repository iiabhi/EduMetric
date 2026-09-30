# 0006: Compose stack scope, and the MinIO image

Status: accepted (F-02)

## Context

1. The F-02 scope lists `web` and `worker` services, but `apps/web` (F-06) and `src/worker.ts` (F-04) do not exist yet.
2. TD-011 requires MinIO for local S3. The official `minio/minio` and `minio/mc` images are no longer pullable from Docker Hub or quay.io, so the natural choice no longer works.
3. The published `alfaarghya/alfa-leetcode-api:2.0.4` image is `linux/amd64` only.

## Decision

1. `web` and `worker` are not added to `docker-compose.yml` in F-02; F-06 and F-04 add them with the code they run. Every service that exists starts healthy, so the acceptance criteria are met for them. No placeholder apps are created.
2. Local MinIO uses `bitnamilegacy/minio:2025.7.23-debian-12-r5` (real MinIO, includes the `mc` client used for bucket creation), pinned by tag. It is frozen and gets no updates, which is acceptable for local development only. Production uses AWS S3 and is unaffected (TD-011).
3. `leetcode-api` sets `platform: linux/amd64`, so it runs under emulation on ARM hosts (for example Apple Silicon).

## Consequences

- F-04 and F-06 each add their compose service (worker shares the api image with its own command, DOCKER-006/007).
- If a maintained MinIO image appears, or F-11 needs a newer S3 server, only the `minio` and `minio-init` image lines change.
- The leetcode-api health check (`GET /`, any status below 500) is provisional; F-15 confirms a real endpoint (DOCKER-008).
