import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_ORIGIN: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET mora imati najmanje 32 znaka'),
  UPLOADS_DIR: z.string().default('../uploads'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Error tracking — opcionalno. Bez DSN-a Sentry je potpuno neaktivan.
  SENTRY_DSN: z.string().url().optional().or(z.literal('')),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Neispravna konfiguracija (.env):');
  for (const issue of parsed.error.issues) {
    console.error(`   ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  uploadsDir: path.resolve(backendRoot, parsed.data.UPLOADS_DIR),
};
