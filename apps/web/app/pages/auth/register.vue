<!--
  Register Page — Stripe-inspired design

  Clean card matching the login page style.
  Password requirements enforced by the same schema on frontend AND backend.

  Layout: 'auth' (centered card with gradient background)
  Middleware: 'guest' (redirect if already logged in)
-->
<template>
  <Card class="border-0 shadow-lg">
    <CardHeader class="pb-4 text-center">
      <CardTitle class="text-xl">Create your account</CardTitle>
      <CardDescription>
        Get started with Paisa today
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <!-- Register Form -->
      <form class="space-y-4" novalidate @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="name">Name</Label>
          <Input
            id="name"
            v-model="formState.name"
            placeholder="Jane Doe"
            autofocus
          />
          <p v-if="errors.name" class="text-sm text-destructive">
            {{ errors.name }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="email">Email</Label>
          <Input
            id="email"
            v-model="formState.email"
            type="email"
            placeholder="you@example.com"
          />
          <p v-if="errors.email" class="text-sm text-destructive">
            {{ errors.email }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="password">Password</Label>
          <Input
            id="password"
            v-model="formState.password"
            type="password"
            placeholder="••••••••"
          />
          <p v-if="errors.password" class="text-sm text-destructive">
            {{ errors.password }}
          </p>
          <p class="text-xs text-muted-foreground">
            At least 8 characters with uppercase, lowercase, and a number.
          </p>
        </div>

        <!-- Server error message -->
        <Alert v-if="errorMessage" variant="destructive">
          <AlertCircle class="h-4 w-4" />
          <AlertDescription>{{ errorMessage }}</AlertDescription>
        </Alert>

        <!-- Submit button -->
        <Button type="submit" class="w-full" :disabled="submitting">
          <Loader2 v-if="submitting" class="mr-2 h-4 w-4 animate-spin" />
          Create account
        </Button>
      </form>

      <!-- Divider + Google OAuth (only when Google auth is enabled) -->
      <template v-if="appConfig.auth.google">
        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div class="relative flex justify-center text-xs uppercase">
            <span class="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <Button variant="outline" class="w-full" @click="registerWithGoogle">
          <svg class="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
          Continue with Google
        </Button>
      </template>
    </CardContent>
    <CardFooter class="justify-center border-t bg-muted/30 py-4">
      <p class="text-sm text-muted-foreground">
        Already have an account?
        <NuxtLink to="/auth/login" class="font-medium text-primary hover:underline">
          Sign in
        </NuxtLink>
      </p>
    </CardFooter>
  </Card>
</template>

<script setup lang="ts">
import { AlertCircle, Loader2 } from 'lucide-vue-next'
import { registerSchema } from '@paisa/shared'

definePageMeta({
  layout: 'auth',
  middleware: 'guest',
})

useHead({ title: 'Create Account' })

const { register } = useAuth()
const config = useRuntimeConfig()
const { appConfig } = useFeatureFlags()

// ─── Form state ───
const formState = reactive({
  name: '',
  email: '',
  password: '',
})

const submitting = ref(false)
const errorMessage = ref('')
const errors = reactive<Record<string, string>>({})

// ─── Client-side validation ───
function validate(): boolean {
  Object.keys(errors).forEach(key => delete errors[key])

  const result = registerSchema.safeParse(formState)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as string
      if (!errors[field]) {
        errors[field] = issue.message
      }
    }
    return false
  }
  return true
}

// ─── Submit handler ───
async function onSubmit() {
  if (!validate()) return

  submitting.value = true
  errorMessage.value = ''

  try {
    await register(formState.email, formState.password, formState.name || undefined)
  } catch (error: any) {
    errorMessage.value =
      error?.data?.error?.message
      || error?.message
      || 'Registration failed. Please try again.'
  } finally {
    submitting.value = false
  }
}

// ─── Google OAuth ───
function registerWithGoogle() {
  const apiBase = config.public.apiBaseUrl as string
  window.location.href = `${apiBase}/auth/google`
}
</script>
