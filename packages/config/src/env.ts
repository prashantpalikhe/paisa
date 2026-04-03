import { z } from 'zod';

/**
 * # Environment Variable Validation
 *
 * Validates all non-feature environment variables at startup.
 * Feature-specific env vars are validated in `features.ts`.
 *
 * ## Usage
 *
 * ```typescript
 * import { parseEnv } from '@paisa/config';
 * const env = parseEnv(process.env);
 * console.log(env.API_PORT); // typed as number
 * ```
 */

export const envSchema = z.object({
  // ─── Core ───
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  API_PORT: z.coerce.number().default(3001),
  API_BASE_URL: z.string().url().default('http://localhost:3001'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  ADMIN_URL: z.string().url().default('http://localhost:3002'),

  // ─── Database ───
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // ─── Auth ───
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // ─── WebAuthn ───
  WEBAUTHN_RP_NAME: z.string().default('Paisa'),
  WEBAUTHN_RP_ID: z.string().default('localhost'),
  WEBAUTHN_ORIGIN: z.string().url().default('http://localhost:3000'),

  // ─── Logging ───
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parses and validates core environment variables.
 * Throws a ZodError with clear messages if required vars are missing.
 */
export function parseEnv(
  env: Record<string, string | undefined>,
): Env {
  return envSchema.parse(env);
}
