<!--
  Pricing Page

  Public page — no auth required.
  Fetches products + plans from GET /stripe/pricing.
  Monthly/yearly toggle when both intervals exist.
  "Get Started" redirects to checkout (auth required) or login.
  Feature-flag gated: shows a placeholder when Stripe is disabled.
-->
<template>
  <div class="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
    <!-- Header -->
    <div class="text-center">
      <h1 class="text-3xl font-bold text-foreground sm:text-4xl">
        Pricing
      </h1>
      <p class="mt-3 text-lg text-muted-foreground">
        Choose the plan that works best for you.
      </p>
    </div>

    <!-- Feature flag: Stripe disabled -->
    <div v-if="!appConfig.features.stripe" class="mt-16 text-center">
      <Card class="mx-auto max-w-md">
        <CardContent class="py-12">
          <p class="text-muted-foreground">
            Billing is not available at this time. Check back soon.
          </p>
        </CardContent>
      </Card>
    </div>

    <!-- Loading state -->
    <div v-else-if="loading" class="mt-16 flex justify-center">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="mt-16">
      <Alert variant="destructive" class="mx-auto max-w-md">
        <AlertCircle class="h-4 w-4" />
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>
    </div>

    <!-- No products -->
    <div v-else-if="!pricing || pricing.length === 0" class="mt-16 text-center">
      <p class="text-muted-foreground">
        No plans available at the moment.
      </p>
    </div>

    <!-- Pricing cards -->
    <template v-else>
      <!-- Interval toggle (only if both monthly and yearly plans exist) -->
      <div v-if="hasMultipleIntervals" class="mt-10 flex justify-center">
        <div class="inline-flex items-center gap-3 rounded-md border border-border p-1">
          <button
            class="rounded px-4 py-2 text-sm font-medium transition-colors"
            :class="[
              billingInterval === 'month'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            ]"
            @click="billingInterval = 'month'"
          >
            Monthly
          </button>
          <button
            class="rounded px-4 py-2 text-sm font-medium transition-colors"
            :class="[
              billingInterval === 'year'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            ]"
            @click="billingInterval = 'year'"
          >
            Yearly
          </button>
        </div>
      </div>

      <!-- Product cards -->
      <div
        class="mt-10 grid gap-8"
        :class="[
          pricing.length === 1 ? 'max-w-md mx-auto' :
          pricing.length === 2 ? 'max-w-3xl mx-auto sm:grid-cols-2' :
          'sm:grid-cols-2 lg:grid-cols-3',
        ]"
      >
        <Card
          v-for="product in pricing"
          :key="product.id"
          class="flex flex-col"
        >
          <CardHeader>
            <CardTitle>{{ product.name }}</CardTitle>
            <CardDescription v-if="product.description">
              {{ product.description }}
            </CardDescription>
          </CardHeader>
          <CardContent class="flex flex-1 flex-col">
            <!-- Price display -->
            <div v-if="getActivePlan(product)" class="mb-6">
              <span class="text-4xl font-bold text-foreground">
                {{ formatPrice(getActivePlan(product)!.priceInCents, getActivePlan(product)!.currency) }}
              </span>
              <span class="text-muted-foreground">
                /{{ getActivePlan(product)!.interval }}
              </span>
              <p v-if="getActivePlan(product)!.trialDays" class="mt-1 text-sm text-muted-foreground">
                {{ getActivePlan(product)!.trialDays }}-day free trial
              </p>
            </div>

            <div v-else class="mb-6">
              <p class="text-sm text-muted-foreground">
                No plan available for this interval.
              </p>
            </div>

            <!-- CTA button -->
            <div class="mt-auto">
              <Button
                class="w-full"
                :disabled="!getActivePlan(product) || checkoutLoading === getActivePlan(product)?.id"
                @click="onGetStarted(getActivePlan(product)!)"
              >
                <Loader2
                  v-if="checkoutLoading === getActivePlan(product)?.id"
                  class="mr-2 h-4 w-4 animate-spin"
                />
                Get started
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </template>

    <!-- Checkout error -->
    <Alert v-if="checkoutError" variant="destructive" class="mx-auto mt-8 max-w-md">
      <AlertCircle class="h-4 w-4" />
      <AlertDescription>{{ checkoutError }}</AlertDescription>
    </Alert>
  </div>
</template>

<script setup lang="ts">
import { AlertCircle, Loader2 } from 'lucide-vue-next'
import type { StripePlan, StripeProduct } from '~/composables/useBilling'

definePageMeta({
  layout: 'default',
})

useHead({ title: 'Pricing' })

const { appConfig } = useFeatureFlags()
const { isAuthenticated } = useAuth()
const { pricing, loading, error, loadPricing, startCheckout } = useBilling()

// ─── Billing interval toggle ───
const billingInterval = ref<'month' | 'year'>('month')

const hasMultipleIntervals = computed(() => {
  if (!pricing.value) return false
  const allPlans = pricing.value.flatMap(p => p.plans)
  const intervals = new Set(allPlans.map(p => p.interval))
  return intervals.has('month') && intervals.has('year')
})

/**
 * Get the plan for the currently selected billing interval.
 * Falls back to the first available plan if no match.
 */
function getActivePlan(product: StripeProduct): StripePlan | null {
  const match = product.plans.find(p => p.interval === billingInterval.value)
  return match || product.plans[0] || null
}

// ─── Price formatting ───
function formatPrice(amount: number, currency: string): string {
  // Stripe amounts are in cents
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount / 100)
}

// ─── Checkout ───
const checkoutLoading = ref<string | null>(null)
const checkoutError = ref('')

async function onGetStarted(plan: StripePlan) {
  // If not logged in, redirect to login first
  if (!isAuthenticated.value) {
    await navigateTo('/auth/login')
    return
  }

  checkoutLoading.value = plan.id
  checkoutError.value = ''

  try {
    await startCheckout(plan.id)
    // startCheckout redirects to Stripe — page will unload
  } catch (e: any) {
    checkoutError.value =
      e?.data?.error?.message
      || e?.message
      || 'Failed to start checkout.'
  } finally {
    checkoutLoading.value = null
  }
}

// ─── Load pricing on mount ───
onMounted(async () => {
  if (appConfig.value.features.stripe) {
    await loadPricing()
  }
})
</script>
