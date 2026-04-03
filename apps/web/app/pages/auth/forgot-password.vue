<!--
  Forgot Password Page

  Sends a password reset email. Uses the shared forgotPasswordSchema.

  Security note: The API returns 200 even if the email doesn't exist,
  to prevent email enumeration attacks. The success message is always
  shown to the user.
-->
<template>
  <Card>
    <CardHeader class="text-center">
      <CardTitle class="text-lg">Reset your password</CardTitle>
      <CardDescription>
        Enter your email and we'll send you a reset link.
      </CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <!-- Success state -->
      <div v-if="emailSent" class="space-y-4">
        <Alert>
          <CheckCircle class="h-4 w-4" />
          <AlertTitle>Check your email</AlertTitle>
          <AlertDescription>
            If an account exists with that email, we've sent a password reset link.
          </AlertDescription>
        </Alert>
        <Button variant="outline" class="w-full" as-child>
          <NuxtLink to="/auth/login">
            Back to sign in
          </NuxtLink>
        </Button>
      </div>

      <!-- Form state -->
      <form v-else class="space-y-4" novalidate @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="email">Email</Label>
          <div class="relative">
            <Mail class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              v-model="formState.email"
              type="email"
              placeholder="you@example.com"
              class="pl-9"
              autofocus
            />
          </div>
          <p v-if="errors.email" class="text-sm text-destructive">
            {{ errors.email }}
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
          Send reset link
        </Button>
      </form>
    </CardContent>
    <CardFooter class="justify-center">
      <p class="text-sm text-muted-foreground">
        Remember your password?
        <NuxtLink to="/auth/login" class="text-primary hover:underline">
          Sign in
        </NuxtLink>
      </p>
    </CardFooter>
  </Card>
</template>

<script setup lang="ts">
import { AlertCircle, CheckCircle, Loader2, Mail } from 'lucide-vue-next'
import { forgotPasswordSchema } from '@paisa/shared'

definePageMeta({
  layout: 'auth',
  middleware: 'guest',
})

useHead({ title: 'Forgot Password' })

const config = useRuntimeConfig()

// ─── Form state ───
const formState = reactive({
  email: '',
})

const submitting = ref(false)
const errorMessage = ref('')
const emailSent = ref(false)
const errors = reactive<Record<string, string>>({})

// ─── Client-side validation ───
function validate(): boolean {
  Object.keys(errors).forEach(key => delete errors[key])

  const result = forgotPasswordSchema.safeParse(formState)
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
    await $fetch('/auth/forgot-password', {
      baseURL: config.public.apiBaseUrl as string,
      method: 'POST',
      body: { email: formState.email },
    })

    // Always show success (prevents email enumeration)
    emailSent.value = true
  } catch (error: any) {
    errorMessage.value =
      error?.data?.error?.message
      || 'Something went wrong. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>
