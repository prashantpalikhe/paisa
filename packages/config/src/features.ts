import { z } from 'zod';

/**
 * # Feature Toggle System
 *
 * Every optional integration is controlled by a feature flag read from environment
 * variables at startup. If a feature is enabled but its required env vars are missing,
 * the app fails fast with a clear error message.
 *
 * ## Infrastructure flags vs Business flags
 *
 * This file defines **infrastructure flags** — they control module loading at bootstrap.
 * Changing them requires a redeploy.
 *
 * **Business flags** (maintenance mode, beta gates, plan limits) live in the database
 * `FeatureFlag` table and are managed via the admin panel at runtime.
 *
 * These two systems must NEVER be mixed. See ARCHITECTURE.md §27 Rule 1.
 *
 * ## Usage
 *
 * ```typescript
 * import { parseFeatures } from '@paisa/config';
 * const features = parseFeatures(process.env);
 * if (features.stripe.enabled) { ... }
 * ```
 */

// ─── Helper: require fields when enabled ───

function requiredWhenEnabled<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  requiredFields: (keyof T)[],
  featureName: string,
) {
  return schema.refine(
    (data: Record<string, unknown>) => {
      if (!data.enabled) return true;
      return requiredFields.every((f) => {
        const val = data[f as string];
        return val != null && val !== '';
      });
    },
    {
      message: `${featureName} requires [${requiredFields.join(', ')}] when enabled`,
    },
  );
}

// ─── Infrastructure feature names (reserved — cannot be used as business flags) ───

export const INFRASTRUCTURE_FLAG_NAMES = [
  'stripe',
  'redis',
  'rabbitmq',
  'sentry',
  'websockets',
] as const;

export type InfrastructureFlagName = (typeof INFRASTRUCTURE_FLAG_NAMES)[number];

// ─── Feature schemas ───

export const featuresSchema = z.object({
  auth: z.object({
    google: requiredWhenEnabled(
      z.object({
        enabled: z.boolean(),
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
        callbackUrl: z.string().optional(),
      }),
      ['clientId', 'clientSecret', 'callbackUrl'],
      'Google OAuth',
    ),
    passkey: z.object({ enabled: z.boolean() }),
    twoFactor: z.object({ enabled: z.boolean() }),
  }),
  email: z.object({
    provider: z.enum(['resend']).default('resend'),
    apiKey: z.string().optional(),
    fromAddress: z.string().optional(),
    /** NODE_ENV passed through so we can conditionally require fields */
    nodeEnv: z.string().optional(),
  }).refine(
    (data) => {
      // apiKey and fromAddress are only required in production.
      // In dev/test, the Console/InMemory providers don't use them.
      if (data.nodeEnv !== 'production') return true;
      return !!(data.apiKey && data.fromAddress);
    },
    {
      message: 'Email (Resend) requires [apiKey, fromAddress] in production',
    },
  ),
  stripe: requiredWhenEnabled(
    z.object({
      enabled: z.boolean(),
      secretKey: z.string().optional(),
      webhookSecret: z.string().optional(),
      publishableKey: z.string().optional(),
    }),
    ['secretKey', 'webhookSecret', 'publishableKey'],
    'Stripe',
  ),
  redis: requiredWhenEnabled(
    z.object({
      enabled: z.boolean(),
      url: z.string().optional(),
    }),
    ['url'],
    'Redis',
  ),
  rabbitmq: requiredWhenEnabled(
    z.object({
      enabled: z.boolean(),
      url: z.string().optional(),
      managementUrl: z.string().optional(),
      managementUser: z.string().optional(),
      managementPassword: z.string().optional(),
    }),
    ['url'],
    'RabbitMQ',
  ),
  storage: z.object({
    provider: z.enum(['r2', 'local']).default('local'),
    r2AccountId: z.string().optional(),
    r2AccessKeyId: z.string().optional(),
    r2SecretAccessKey: z.string().optional(),
    r2BucketName: z.string().optional(),
    r2PublicUrl: z.string().optional(),
  }).refine(
    (data) => {
      if (data.provider !== 'r2') return true;
      return !!(
        data.r2AccountId &&
        data.r2AccessKeyId &&
        data.r2SecretAccessKey &&
        data.r2BucketName
      );
    },
    {
      message:
        'Storage (R2) requires r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2BucketName when provider is r2',
    },
  ),
  websockets: z.object({ enabled: z.boolean() }),
  sentry: requiredWhenEnabled(
    z.object({
      enabled: z.boolean(),
      dsn: z.string().optional(),
    }),
    ['dsn'],
    'Sentry',
  ),
});

export type Features = z.infer<typeof featuresSchema>;

// ─── Parse features from env vars ───

/**
 * Reads FEATURE_* env vars and returns a validated features object.
 * Throws a ZodError with clear messages if enabled features are missing config.
 */
export function parseFeatures(env: Record<string, string | undefined>): Features {
  const raw: unknown = {
    auth: {
      google: {
        enabled: env.FEATURE_AUTH_GOOGLE_ENABLED === 'true',
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackUrl: env.GOOGLE_CALLBACK_URL,
      },
      passkey: {
        enabled: env.FEATURE_AUTH_PASSKEY_ENABLED !== 'false', // default true
      },
      twoFactor: {
        enabled: env.FEATURE_AUTH_2FA_ENABLED !== 'false', // default true
      },
    },
    email: {
      provider: env.EMAIL_PROVIDER || 'resend',
      apiKey: env.RESEND_API_KEY,
      fromAddress: env.EMAIL_FROM,
      nodeEnv: env.NODE_ENV,
    },
    stripe: {
      enabled: env.FEATURE_STRIPE_ENABLED === 'true',
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      publishableKey: env.STRIPE_PUBLISHABLE_KEY,
    },
    redis: {
      enabled: env.FEATURE_REDIS_ENABLED === 'true',
      url: env.REDIS_URL,
    },
    rabbitmq: {
      enabled: env.FEATURE_RABBITMQ_ENABLED === 'true',
      url: env.RABBITMQ_URL,
      managementUrl: env.RABBITMQ_MANAGEMENT_URL,
      managementUser: env.RABBITMQ_MANAGEMENT_USER,
      managementPassword: env.RABBITMQ_MANAGEMENT_PASSWORD,
    },
    storage: {
      provider: env.STORAGE_PROVIDER || 'local',
      r2AccountId: env.R2_ACCOUNT_ID,
      r2AccessKeyId: env.R2_ACCESS_KEY_ID,
      r2SecretAccessKey: env.R2_SECRET_ACCESS_KEY,
      r2BucketName: env.R2_BUCKET_NAME,
      r2PublicUrl: env.R2_PUBLIC_URL,
    },
    websockets: {
      enabled: env.FEATURE_WEBSOCKETS_ENABLED === 'true',
    },
    sentry: {
      enabled: env.FEATURE_SENTRY_ENABLED === 'true',
      dsn: env.SENTRY_DSN,
    },
  };

  return featuresSchema.parse(raw);
}
