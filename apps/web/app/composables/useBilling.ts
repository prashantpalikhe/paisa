/**
 * # Billing Composable
 *
 * Manages Stripe billing state: pricing, subscriptions, purchases.
 *
 * ## Token strategy
 *
 * - Pricing is public (no auth needed) — uses raw `$fetch`
 * - Everything else requires auth — uses `apiFetch` from `useAuth()`
 * - Checkout and portal return URLs — we redirect the browser to Stripe
 *
 * ## State
 *
 * Uses `useState` for SSR-safe shared state, same pattern as `useAuth`.
 * All state is keyed with 'billing-' prefix to avoid collisions.
 */

// ─── Types ───

export interface StripePlan {
  id: string
  name: string
  priceInCents: number
  currency: string
  interval: string
  intervalCount: number
  trialDays: number | null
  features: string[]
  highlighted: boolean
}

export interface StripeProduct {
  id: string
  name: string
  description: string | null
  plans: StripePlan[]
}

export interface StripeSubscription {
  id: string
  status: string
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  canceledAt: string | null
  plan: {
    id: string
    name: string
    priceInCents: number
    currency: string
    interval: string
    intervalCount: number
    product: {
      id: string
      name: string
      description: string | null
    }
  }
}

export interface StripePayment {
  id: string
  amount: number
  currency: string
  status: string
  description: string | null
  createdAt: string
}

export interface StripePurchases {
  subscriptions: StripeSubscription[]
  payments: StripePayment[]
}

export function useBilling() {
  // ─── State ───
  const pricing = useState<StripeProduct[] | null>('billing-pricing', () => null)
  const subscription = useState<StripeSubscription | null>('billing-subscription', () => null)
  const purchases = useState<StripePurchases | null>('billing-purchases', () => null)
  const loading = useState<boolean>('billing-loading', () => false)
  const error = useState<string>('billing-error', () => '')

  const { apiFetch } = useAuth()
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBaseUrl as string

  // ─── Public endpoints (no auth) ───

  /**
   * Fetch pricing data from the public endpoint.
   * No authentication required — used on the public pricing page.
   */
  async function loadPricing(): Promise<void> {
    loading.value = true
    error.value = ''

    try {
      const response = await $fetch<{ data: StripeProduct[] }>('/stripe/pricing', {
        baseURL: apiBase,
      })
      pricing.value = response.data
    } catch (e: any) {
      error.value =
        e?.data?.error?.message
        || e?.message
        || 'Failed to load pricing.'
    } finally {
      loading.value = false
    }
  }

  // ─── Authenticated endpoints ───

  /**
   * Fetch the current user's active subscription.
   * Returns null if the user has no subscription.
   */
  async function loadSubscription(): Promise<void> {
    loading.value = true
    error.value = ''

    try {
      subscription.value = await apiFetch<StripeSubscription | null>('/stripe/subscription')
    } catch (e: any) {
      error.value =
        e?.data?.error?.message
        || e?.message
        || 'Failed to load subscription.'
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch the user's purchase history (subscriptions + one-time payments).
   */
  async function loadPurchases(): Promise<void> {
    loading.value = true
    error.value = ''

    try {
      purchases.value = await apiFetch<StripePurchases>('/stripe/purchases')
    } catch (e: any) {
      error.value =
        e?.data?.error?.message
        || e?.message
        || 'Failed to load purchase history.'
    } finally {
      loading.value = false
    }
  }

  /**
   * Start a Stripe Checkout session and redirect to it.
   * The API returns a Stripe-hosted URL — we navigate the browser there.
   */
  async function startCheckout(planId: string): Promise<void> {
    error.value = ''

    try {
      const result = await apiFetch<{ url: string }>('/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify({ planId }),
        headers: { 'Content-Type': 'application/json' },
      })

      // Redirect to Stripe Checkout
      window.location.href = result.url
    } catch (e: any) {
      error.value =
        e?.data?.error?.message
        || e?.message
        || 'Failed to start checkout.'
    }
  }

  /**
   * Cancel a subscription at the end of the current billing period.
   */
  async function cancelSubscription(subscriptionId: string): Promise<void> {
    error.value = ''

    try {
      await apiFetch('/stripe/subscription/cancel', {
        method: 'POST',
        body: JSON.stringify({ subscriptionId }),
        headers: { 'Content-Type': 'application/json' },
      })

      // Reload subscription to reflect the updated cancelAtPeriodEnd state
      await loadSubscription()
    } catch (e: any) {
      error.value =
        e?.data?.error?.message
        || e?.message
        || 'Failed to cancel subscription.'
    }
  }

  /**
   * Resume a subscription that was scheduled for cancellation.
   */
  async function resumeSubscription(subscriptionId: string): Promise<void> {
    error.value = ''

    try {
      await apiFetch('/stripe/subscription/resume', {
        method: 'POST',
        body: JSON.stringify({ subscriptionId }),
        headers: { 'Content-Type': 'application/json' },
      })

      // Reload subscription to reflect the resumed state
      await loadSubscription()
    } catch (e: any) {
      error.value =
        e?.data?.error?.message
        || e?.message
        || 'Failed to resume subscription.'
    }
  }

  /**
   * Open the Stripe Customer Portal.
   * Lets the user manage payment methods, invoices, etc.
   */
  async function openPortal(): Promise<void> {
    error.value = ''

    try {
      const result = await apiFetch<{ url: string }>('/stripe/portal', {
        method: 'POST',
      })

      window.location.href = result.url
    } catch (e: any) {
      error.value =
        e?.data?.error?.message
        || e?.message
        || 'Failed to open billing portal.'
    }
  }

  return {
    // State
    pricing,
    subscription,
    purchases,
    loading,
    error,

    // Actions
    loadPricing,
    loadSubscription,
    loadPurchases,
    startCheckout,
    cancelSubscription,
    resumeSubscription,
    openPortal,
  }
}
