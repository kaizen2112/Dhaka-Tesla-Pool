# ---- build: install everything, generate the Prisma client, compile TypeScript ----
FROM node:22-alpine AS build
# Prisma's schema engine (used by migrate) needs OpenSSL, which Alpine doesn't ship by default.
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# prisma.config.ts reads DIRECT_URL even for `generate`, which never connects — a placeholder is enough.
RUN DIRECT_URL=postgresql://build:build@localhost:5432/build npx prisma generate
RUN npm run build

# ---- runtime ----
FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

# ponytail: ships dev dependencies too, because the Prisma CLI and ts-node run migrate + seed
# at startup. Prune them (and precompile seed.ts) if image size ever matters.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/package.json /app/prisma.config.ts /app/tsconfig.json ./

USER node
EXPOSE 3000

# migrate deploy only ever applies committed migrations (never `migrate dev` in a container).
# The seed is idempotent, so running it on every start is safe. `exec` makes node PID 1, so
# `docker stop` reaches it directly.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && exec node dist/main"]
