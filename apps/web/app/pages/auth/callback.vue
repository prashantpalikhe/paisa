<!--
  OAuth Callback Page

  Handles the redirect from the API after a successful Google OAuth flow.

  ## Flow
  1. User clicks "Continue with Google" → browser goes to API /auth/google
  2. API redirects to Google → user authenticates
  3. Google redirects to API /auth/google/callback
  4. API sets httpOnly refresh cookie + redirects to:
     FRONTEND_URL/auth/callback?token=<accessToken>&expiresIn=<seconds>
  5. THIS page reads the token from the URL, stores in memory, clears the URL

  ## Why read from URL?
  The API can't set JavaScript variables directly — it's a redirect, not a fetch.
  The access token in the URL is short-lived (15 min) and cleared immediately.
  The refresh token is in the httpOnly cookie (secure, invisible to JS).
-->
<template>
  <Card>
    <CardContent class="flex flex-col items-center gap-4 py-8">
      <Loader2 class="h-8 w-8 animate-spin text-primary" />
      <p class="text-sm text-muted-foreground">
        {{ statusMessage }}
      </p>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'

definePageMeta({
  layout: 'auth',
})

useHead({ title: 'Signing in...' })

const { setTokens, fetchUser } = useAuth()

const statusMessage = ref('Completing sign in...')

onMounted(async () => {
  const route = useRoute()

  // ─── Extract tokens from URL query ───
  const token = route.query.token as string | undefined
  const expiresIn = route.query.expiresIn
    ? Number(route.query.expiresIn)
    : undefined

  if (!token || !expiresIn) {
    statusMessage.value = 'Sign in failed. Redirecting...'
    await navigateTo('/auth/login')
    return
  }

  // ─── Store access token in memory ───
  setTokens(token, expiresIn)

  // ─── Clean up URL ───
  // Remove token from URL so it's not in browser history
  window.history.replaceState({}, '', '/auth/callback')

  // ─── Fetch user profile ───
  statusMessage.value = 'Loading your account...'
  await fetchUser()

  // ─── Navigate to dashboard ───
  await navigateTo('/dashboard')
})
</script>
