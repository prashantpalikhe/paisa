/**
 * # Domain Event Payload Types
 *
 * Typed payloads for every domain event in the system.
 * Used by both the EMITTER (e.g., AuthService) and the CONSUMER
 * (e.g., EmailEventListener) so they agree on the data shape.
 *
 * ## Why shared types for events?
 *
 * Without these, events are `Record<string, unknown>` — you'd have no
 * IDE autocompletion, no compiler errors if a field is renamed, and no
 * way to know what data an event carries without reading the emitter code.
 *
 * ## Convention
 *
 * Every event payload includes at least `userId` (who triggered it).
 * Events that send emails also include `email` and `name` so the
 * email module doesn't need to look up the user from the database.
 */

// ─── Auth Events ───

export interface UserRegisteredPayload {
  userId: string;
  email: string;
  name: string | null;
  /** Token for email verification link. Absent for OAuth registrations. */
  verificationToken?: string;
  /** Set when the user registered via OAuth (e.g., 'google'). */
  oauthProvider?: string;
}

export interface UserVerificationResentPayload {
  userId: string;
  email: string;
  name: string | null;
  verificationToken: string;
}

export interface UserVerifiedEmailPayload {
  userId: string;
  email: string;
}

export interface UserLoggedInPayload {
  userId: string;
  email: string;
  /** Set when the user logged in via OAuth. */
  oauthProvider?: string;
}

export interface UserPasswordResetRequestedPayload {
  userId: string;
  email: string;
  name: string | null;
  resetToken: string;
}

export interface UserPasswordChangedPayload {
  userId: string;
  email: string;
  name: string | null;
}

export interface UserOAuthLinkedPayload {
  userId: string;
  email: string;
  name: string | null;
  /** Which provider was linked (e.g., 'google'). */
  provider: string;
}
