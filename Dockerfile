# Development image for the API (F-02). The production image (multi-stage, no dev dependencies,
# Prisma client generated at build time) is added in F-23 (DOCKER-010).
FROM node:20-alpine AS dev

WORKDIR /app
RUN chown node:node /app
USER node

# Install dependencies from the lockfile only, so this layer is cached until dependencies change.
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node apps/api/package.json apps/api/
COPY --chown=node:node packages/shared/package.json packages/shared/
# postinstall runs `prisma generate`, which needs the schema, the config and the config's local import
# (apps/api/src/config/dockerBuild.test.ts fails if this list misses one).
COPY --chown=node:node apps/api/prisma apps/api/prisma/
COPY --chown=node:node apps/api/prisma.config.ts apps/api/
COPY --chown=node:node apps/api/src/config/loadEnv.ts apps/api/src/config/
RUN npm ci

# Source is bind-mounted by docker-compose.yml for hot reload; this copy makes the image runnable alone.
COPY --chown=node:node . .

ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm", "run", "dev"]
