<!--
  Checkout Success Page

  Shown after a successful Stripe Checkout session.
  Stripe redirects back to this URL after payment.
  Auth middleware: user must be logged in.
-->
<template>
  <div class="flex min-h-[60vh] items-center justify-center">
    <Card class="mx-auto max-w-md text-center">
      <CardHeader>
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle class="h-6 w-6 text-primary" />
        </div>
        <CardTitle class="text-xl">Payment successful</CardTitle>
        <CardDescription>
          Thank you for your purchase. Your subscription is now active.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <Button as-child>
          <NuxtLink to="/settings/billing">
            Go to Billing
          </NuxtLink>
        </Button>
        <Button variant="outline" as-child>
          <NuxtLink to="/dashboard">
            Back to Dashboard
          </NuxtLink>
        </Button>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { CheckCircle } from 'lucide-vue-next'

definePageMeta({
  middleware: 'auth',
})

useHead({ title: 'Payment Successful' })
</script>
