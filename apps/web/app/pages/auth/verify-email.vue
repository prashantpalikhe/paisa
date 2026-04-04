<!--
  Email Verification Page

  The user arrives here from a link in their email:
    /auth/verify-email?token=abc123

  On mount, automatically submits the token to the API.
  Shows a loading spinner, then success or error.
-->
<template>
  <Card class="border-0 shadow-lg">
    <CardHeader class="pb-4 text-center">
      <CardTitle class="text-xl">Email Verification</CardTitle>
    </CardHeader>
    <CardContent>
      <!-- Loading state — auto-verifying -->
      <div v-if="verifying" class="flex flex-col items-center gap-4 py-8">
        <Loader2 class="h-8 w-8 animate-spin text-primary" />
        <p class="text-sm text-muted-foreground">
          Verifying your email...
        </p>
      </div>

      <!-- Success state -->
      <div v-else-if="verified" class="space-y-4">
        <Alert>
          <CheckCircle class="h-4 w-4" />
          <AlertTitle>Email verified!</AlertTitle>
          <AlertDescription>
            Your email has been verified. You can now access all features.
          </AlertDescription>
        </Alert>
        <Button class="w-full" as-child>
          <NuxtLink to="/dashboard">
            Go to dashboard
          </NuxtLink>
        </Button>
      </div>

      <!-- Error state -->
      <div v-else class="space-y-4">
        <Alert variant="destructive">
          <AlertCircle class="h-4 w-4" />
          <AlertTitle>Verification failed</AlertTitle>
          <AlertDescription>{{ errorMessage }}</AlertDescription>
        </Alert>
        <Button variant="outline" class="w-full" as-child>
          <NuxtLink to="/auth/login">
            Back to sign in
          </NuxtLink>
        </Button>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-vue-next'

definePageMeta({
  layout: 'auth',
  // No middleware — both authenticated and unauthenticated users
  // might click the verification link
})

useHead({ title: 'Verify Email' })

const route = useRoute()
const config = useRuntimeConfig()

const token = computed(() => route.query.token as string | undefined)

const verifying = ref(true)
const verified = ref(false)
const errorMessage = ref('This verification link is invalid or has expired.')

// ─── Auto-verify on mount ───
onMounted(async () => {
  if (!token.value) {
    verifying.value = false
    errorMessage.value = 'No verification token found. Please check your email link.'
    return
  }

  try {
    await $fetch('/auth/verify-email', {
      baseURL: config.public.apiBaseUrl as string,
      method: 'POST',
      body: { token: token.value },
    })
    verified.value = true
  } catch (error: any) {
    errorMessage.value =
      error?.data?.error?.message
      || 'This verification link is invalid or has expired.'
  } finally {
    verifying.value = false
  }
})
</script>
