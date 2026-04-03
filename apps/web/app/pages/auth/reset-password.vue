<!--
  Reset Password Page

  The user arrives here from a link in their email:
    /auth/reset-password?token=abc123

  The token is extracted from the URL query and sent along with
  the new password to the API.
-->
<template>
  <Card>
    <CardHeader class="text-center">
      <CardTitle class="text-lg">Set a new password</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <!-- Missing token error -->
      <Alert v-if="!token" variant="destructive">
        <AlertCircle class="h-4 w-4" />
        <AlertTitle>Invalid reset link</AlertTitle>
        <AlertDescription>
          This password reset link is invalid or has expired. Please request a new one.
        </AlertDescription>
      </Alert>

      <!-- Success state -->
      <div v-else-if="resetSuccess" class="space-y-4">
        <Alert>
          <CheckCircle class="h-4 w-4" />
          <AlertTitle>Password updated</AlertTitle>
          <AlertDescription>
            Your password has been reset. You can now sign in with your new password.
          </AlertDescription>
        </Alert>
        <Button class="w-full" as-child>
          <NuxtLink to="/auth/login">
            Sign in
          </NuxtLink>
        </Button>
      </div>

      <!-- Reset form -->
      <form v-else class="space-y-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="password">New password</Label>
          <div class="relative">
            <Lock class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              v-model="formState.password"
              type="password"
              placeholder="••••••••"
              class="pl-9"
              autofocus
            />
          </div>
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

        <Button type="submit" class="w-full" :disabled="submitting">
          <Loader2 v-if="submitting" class="mr-2 h-4 w-4 animate-spin" />
          Reset password
        </Button>
      </form>
    </CardContent>
    <CardFooter class="justify-center">
      <p class="text-sm text-muted-foreground">
        <NuxtLink to="/auth/login" class="text-primary hover:underline">
          Back to sign in
        </NuxtLink>
      </p>
    </CardFooter>
  </Card>
</template>

<script setup lang="ts">
import { AlertCircle, CheckCircle, Loader2, Lock } from 'lucide-vue-next'
import { passwordSchema } from '@paisa/shared'
import { z } from 'zod'

definePageMeta({
  layout: 'auth',
  middleware: 'guest',
})

useHead({ title: 'Reset Password' })

const route = useRoute()
const config = useRuntimeConfig()

// Extract token from URL query: /auth/reset-password?token=abc123
const token = computed(() => route.query.token as string | undefined)

// We only show the password field — the token comes from the URL
const formSchema = z.object({
  password: passwordSchema,
})

const formState = reactive({
  password: '',
})

const submitting = ref(false)
const errorMessage = ref('')
const resetSuccess = ref(false)
const errors = reactive<Record<string, string>>({})

// ─── Client-side validation ───
function validate(): boolean {
  Object.keys(errors).forEach(key => delete errors[key])

  const result = formSchema.safeParse(formState)
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
  if (!token.value || !validate()) return

  submitting.value = true
  errorMessage.value = ''

  try {
    await $fetch('/auth/reset-password', {
      baseURL: config.public.apiBaseUrl as string,
      method: 'POST',
      body: {
        token: token.value,
        password: formState.password,
      },
    })

    resetSuccess.value = true
  } catch (error: any) {
    errorMessage.value =
      error?.data?.error?.message
      || 'This reset link is invalid or has expired. Please request a new one.'
  } finally {
    submitting.value = false
  }
}
</script>
