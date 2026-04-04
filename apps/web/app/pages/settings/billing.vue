<!--
  Billing Settings Page

  Shows current subscription, cancel/resume actions, Stripe Portal link,
  and purchase history. Feature-flag gated via Stripe feature flag.
  Follows the same layout pattern as profile.vue and security.vue.
-->
<template>
  <div>
    <!-- Page header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-foreground">Settings</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Manage your account settings and preferences.
      </p>
    </div>

    <!-- Settings layout: sidebar + content -->
    <div class="flex flex-col gap-8 sm:flex-row">
      <aside class="w-full sm:w-48">
        <SettingsNav />
      </aside>

      <div class="flex-1 space-y-6">
        <!-- Feature flag: Stripe disabled -->
        <Card v-if="!appConfig.features.stripe">
          <CardContent class="py-12 text-center">
            <p class="text-muted-foreground">
              Billing is not available at this time.
            </p>
          </CardContent>
        </Card>

        <template v-else>
          <!-- Loading state -->
          <div v-if="initialLoading" class="flex justify-center py-12">
            <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
          </div>

          <template v-else>
            <!-- Current Subscription -->
            <Card>
              <CardHeader>
                <CardTitle>Subscription</CardTitle>
                <CardDescription>
                  Your current plan and billing details.
                </CardDescription>
              </CardHeader>
              <CardContent class="space-y-4">
                <!-- No subscription -->
                <div v-if="!subscription">
                  <p class="text-sm text-muted-foreground">
                    You don't have an active subscription.
                  </p>
                  <Button class="mt-4" as-child>
                    <NuxtLink to="/pricing">
                      View plans
                    </NuxtLink>
                  </Button>
                </div>

                <!-- Active subscription -->
                <div v-else class="space-y-4">
                  <div class="flex flex-wrap items-start justify-between gap-4 rounded-md border border-border p-4">
                    <div class="space-y-1">
                      <div class="flex items-center gap-2">
                        <p class="text-sm font-medium">
                          {{ subscription.plan.product.name }}
                          — {{ subscription.plan.name }}
                        </p>
                        <Badge :variant="statusVariant">
                          {{ statusLabel }}
                        </Badge>
                      </div>
                      <p class="text-sm text-muted-foreground">
                        {{ formatPrice(subscription.plan.priceInCents, subscription.plan.currency) }}/{{ subscription.plan.interval }}
                      </p>
                      <p v-if="subscription.cancelAtPeriodEnd" class="text-sm text-destructive">
                        Cancels on {{ formatDate(subscription.currentPeriodEnd) }}
                      </p>
                      <p v-else class="text-sm text-muted-foreground">
                        Next billing date: {{ formatDate(subscription.currentPeriodEnd) }}
                      </p>
                    </div>
                  </div>

                  <!-- Action buttons -->
                  <div class="flex flex-wrap gap-3">
                    <!-- Cancel -->
                    <Button
                      v-if="!subscription.cancelAtPeriodEnd && subscription.status === 'active'"
                      variant="outline"
                      :disabled="actionLoading"
                      @click="onCancel"
                    >
                      <Loader2 v-if="actionLoading === 'cancel'" class="mr-2 h-4 w-4 animate-spin" />
                      Cancel subscription
                    </Button>

                    <!-- Resume -->
                    <Button
                      v-if="subscription.cancelAtPeriodEnd"
                      :disabled="actionLoading"
                      @click="onResume"
                    >
                      <Loader2 v-if="actionLoading === 'resume'" class="mr-2 h-4 w-4 animate-spin" />
                      Resume subscription
                    </Button>

                    <!-- Stripe Portal -->
                    <Button
                      variant="outline"
                      :disabled="!!actionLoading"
                      @click="onOpenPortal"
                    >
                      <Loader2 v-if="actionLoading === 'portal'" class="mr-2 h-4 w-4 animate-spin" />
                      Manage billing
                    </Button>
                  </div>
                </div>

                <!-- Error / success messages -->
                <Alert v-if="successMessage" class="border-primary/20 bg-primary/5">
                  <CheckCircle class="h-4 w-4 text-primary" />
                  <AlertDescription>{{ successMessage }}</AlertDescription>
                </Alert>
                <Alert v-if="error" variant="destructive">
                  <AlertCircle class="h-4 w-4" />
                  <AlertDescription>{{ error }}</AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <!-- Purchase History -->
            <Card>
              <CardHeader>
                <CardTitle>Purchase history</CardTitle>
                <CardDescription>
                  Your past payments and invoices.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div v-if="!purchases || (purchases.payments.length === 0 && purchases.subscriptions.length === 0)">
                  <p class="text-sm text-muted-foreground">
                    No purchase history yet.
                  </p>
                </div>

                <div v-else class="space-y-3">
                  <!-- Payment list -->
                  <div
                    v-for="payment in purchases.payments"
                    :key="payment.id"
                    class="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4"
                  >
                    <div class="space-y-1">
                      <p class="text-sm font-medium">
                        {{ payment.description || 'Payment' }}
                      </p>
                      <p class="text-xs text-muted-foreground">
                        {{ formatDate(payment.createdAt) }}
                      </p>
                    </div>
                    <div class="flex items-center gap-3">
                      <Badge
                        :variant="payment.status === 'succeeded' ? 'outline' : 'destructive'"
                      >
                        {{ payment.status }}
                      </Badge>
                      <p class="text-sm font-medium">
                        {{ formatPrice(payment.amount, payment.currency) }}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-vue-next'

definePageMeta({
  middleware: 'auth',
})

useHead({ title: 'Billing Settings' })

const { appConfig } = useFeatureFlags()
const {
  subscription,
  purchases,
  error,
  loadSubscription,
  loadPurchases,
  cancelSubscription,
  resumeSubscription,
  openPortal,
} = useBilling()

// ─── Loading states ───
const initialLoading = ref(true)
const actionLoading = ref<string | null>(null)
const successMessage = ref('')

// ─── Subscription status helpers ───
const statusLabel = computed(() => {
  if (!subscription.value) return ''
  if (subscription.value.cancelAtPeriodEnd) return 'Cancelling'
  const status = subscription.value.status
  return status.charAt(0).toUpperCase() + status.slice(1)
})

const statusVariant = computed<'outline' | 'destructive'>(() => {
  if (!subscription.value) return 'outline'
  if (subscription.value.cancelAtPeriodEnd) return 'destructive'
  if (subscription.value.status === 'active') return 'outline'
  return 'destructive'
})

// ─── Formatting ───
function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount / 100)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ─── Actions ───
async function onCancel() {
  if (!subscription.value) return

  actionLoading.value = 'cancel'
  successMessage.value = ''

  try {
    await cancelSubscription(subscription.value.id)
    successMessage.value = 'Your subscription will be cancelled at the end of the billing period.'
  } finally {
    actionLoading.value = null
  }
}

async function onResume() {
  if (!subscription.value) return

  actionLoading.value = 'resume'
  successMessage.value = ''

  try {
    await resumeSubscription(subscription.value.id)
    successMessage.value = 'Your subscription has been resumed.'
  } finally {
    actionLoading.value = null
  }
}

async function onOpenPortal() {
  actionLoading.value = 'portal'
  try {
    await openPortal()
    // openPortal() redirects — page will unload
  } finally {
    actionLoading.value = null
  }
}

// ─── Load data on mount ───
onMounted(async () => {
  if (appConfig.value.features.stripe) {
    try {
      await Promise.all([
        loadSubscription(),
        loadPurchases(),
      ])
    } finally {
      initialLoading.value = false
    }
  } else {
    initialLoading.value = false
  }
})
</script>
