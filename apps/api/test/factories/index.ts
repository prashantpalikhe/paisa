/**
 * # Test Factories
 *
 * Factory functions for creating test data in the database.
 * Each factory generates entities with sensible defaults that
 * can be overridden per test.
 *
 * ```typescript
 * import { createUser, createProduct, createPlan } from '../factories';
 * ```
 */
export {
  createUser,
  resetUserCounter,
  type CreateUserOptions,
} from './user.factory';

export {
  createProduct,
  createPlan,
  resetProductCounters,
  type CreateProductOptions,
  type CreatePlanOptions,
} from './product.factory';
