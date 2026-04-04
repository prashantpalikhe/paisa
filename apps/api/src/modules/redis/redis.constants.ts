/**
 * Injection tokens for the Redis module.
 *
 * - REDIS_CLIENT: The raw ioredis client instance (null when Redis is disabled)
 * - TOKEN_STORE: Token store for email verification and password reset tokens
 * - CHALLENGE_STORE: Challenge store for WebAuthn challenges
 */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
export const TOKEN_STORE = Symbol('TOKEN_STORE');
export const CHALLENGE_STORE = Symbol('CHALLENGE_STORE');
