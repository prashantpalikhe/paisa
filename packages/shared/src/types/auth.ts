/**
 * Auth-related types shared between frontend and backend.
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  emailVerified: boolean;
  avatarUrl: string | null;
  has2FA: boolean;
  hasPasskey: boolean;
}

export type UserRole = 'USER' | 'ADMIN';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface AuthTokens {
  accessToken: string;
  /** Refresh token is in httpOnly cookie, not in response body */
  expiresIn: number;
}

export interface TwoFactorRequiredResponse {
  requiresTwoFactor: true;
  tempToken: string;
}

export type LoginResponse = AuthTokens | TwoFactorRequiredResponse;

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface TwoFactorVerifyRequest {
  code: string;
  tempToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ─── Profile ───

export interface UpdateProfileRequest {
  name: string;
}

export interface DeleteAccountRequest {
  password: string;
}

// ─── OAuth ───

/** Supported OAuth providers. Extend this as new providers are added. */
export type OAuthProvider = 'google';

/**
 * Data extracted from an OAuth provider during the callback.
 * Used by UserService.findOrCreateOAuthUser() to create or link accounts.
 */
export interface OAuthProfile {
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
}
