// Types
export type {
  ApiResponse,
  PaginatedResponse,
  ApiErrorResponse,
  ApiFieldError,
  PaginationQuery,
  SortQuery,
} from './types/api';

export type {
  AuthUser,
  UserRole,
  LoginRequest,
  RegisterRequest,
  AuthTokens,
  TwoFactorRequiredResponse,
  LoginResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  TwoFactorVerifyRequest,
  ChangePasswordRequest,
  UpdateProfileRequest,
  DeleteAccountRequest,
  OAuthProvider,
  OAuthProfile,
} from './types/auth';

export type {
  UserRegisteredPayload,
  UserVerificationResentPayload,
  UserVerifiedEmailPayload,
  UserLoggedInPayload,
  UserPasswordResetRequestedPayload,
  UserPasswordChangedPayload,
  UserOAuthLinkedPayload,
} from './types/domain-events';

export type {
  Product,
  Plan,
  PlanInterval,
  Subscription,
  SubscriptionStatus,
  Payment,
  PaymentStatus,
} from './types/billing';

// Constants
export {
  ROLES,
  SUBSCRIPTION_STATUS,
  ACTIVE_SUBSCRIPTION_STATUSES,
  OAUTH_PROVIDERS,
  PAGINATION,
  DOMAIN_EVENTS,
} from './constants';

// Validators
export {
  emailSchema,
  passwordSchema,
  nameSchema,
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  changePasswordSchema,
  setPasswordSchema,
  updateProfileSchema,
  deleteAccountSchema,
  twoFactorVerifySchema,
  passkeyRegistrationSchema,
  passkeyAuthenticationSchema,
  passkeyRenameSchema,
} from './validators/auth';

export {
  createProductSchema,
  createPlanSchema,
} from './validators/billing';
