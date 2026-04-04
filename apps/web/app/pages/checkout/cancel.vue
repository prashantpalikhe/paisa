<!--
  Checkout Cancel Page

  Shown when the user cancels Stripe Checkout (clicks the back button).
  Auth middleware: user must be logged in.
-->
<template>
  <div class="flex min-h-[60vh] items-center justify-center">
    <Card class="mx-auto max-w-md text-center">
      <CardHeader>
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <XCircle class="h-6 w-6 text-muted-foreground" />
        </div>
        <CardTitle class="text-xl">Checkout cancelled</CardTitle>
        <CardDescription>
          Your checkout session was cancelled. No charges were made.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <Button as-child>
          <NuxtLink to="/pricing">
            Back to Pricing
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
import { XCircle } from 'lucide-vue-next'

definePageMeta({
  middleware: 'auth',
})

useHead({ title: 'Checkout Cancelled' })
</script>
