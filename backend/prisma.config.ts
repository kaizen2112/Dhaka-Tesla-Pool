import 'dotenv/config';
import { defineConfig, env } from '@prisma/config';

// Prisma 7 CLI config (migrate, studio, seed). Migrations need a direct (non-pooled)
// session, so this uses DIRECT_URL — the running app uses the pooled DATABASE_URL
// instead, via the adapter in src/prisma/prisma.service.ts.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DIRECT_URL'),
  },
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
});
