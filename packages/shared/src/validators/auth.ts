import { z } from 'zod';

/**
 * Shared Zod schemas for auth validation.
 * Used by both the NestJS API (request validation) and the Nuxt frontend (form validation).
 */

export const emailSchema = z.string().email('Invalid email address').max(255);

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one lowercase letter, one uppercase letter, and one number',
  );

export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must be at most 100 characters')
  .optional();

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export const setPasswordSchema = z.object({
  password: passwordSchema,
});

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters')
    .trim(),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

// ─── Passkey ───

export const passkeyRegistrationSchema = z.object({
  response: z.record(z.unknown()), // RegistrationResponseJSON — validated by @simplewebauthn/server
  deviceName: z
    .string()
    .max(100, 'Device name must be at most 100 characters')
    .optional(),
});

export const passkeyAuthenticationSchema = z.object({
  response: z.record(z.unknown()), // AuthenticationResponseJSON — validated by @simplewebauthn/server
  sessionId: z.string().min(1, 'Session ID is required'),
});

export const passkeyRenameSchema = z.object({
  deviceName: z
    .string()
    .min(1, 'Device name is required')
    .max(100, 'Device name must be at most 100 characters'),
});

export const twoFactorVerifySchema = z.object({
  code: z
    .string()
    .min(6, 'Code must be 6 digits')
    .max(8, 'Code must be at most 8 characters'), // backup codes can be longer
  tempToken: z.string().min(1, 'Temp token is required'),
});
