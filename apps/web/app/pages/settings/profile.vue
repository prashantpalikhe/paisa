<!--
  Profile Settings Page

  Edit name, view email (read-only), avatar placeholder.
  Uses PATCH /users/me to update the profile.
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
        <!-- Profile form -->
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Update your personal information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form class="space-y-4" novalidate @submit.prevent="onSubmit">
              <!-- Avatar (read-only for now) -->
              <div class="flex items-center gap-4">
                <Avatar class="h-16 w-16">
                  <AvatarImage v-if="user?.avatarUrl" :src="user.avatarUrl" :alt="user.name || ''" />
                  <AvatarFallback class="text-lg">
                    {{ initials }}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p class="text-sm font-medium text-foreground">
                    {{ user?.name || user?.email }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    Avatar uploads coming soon
                  </p>
                </div>
              </div>

              <Separator />

              <!-- Name -->
              <div class="space-y-2">
                <Label for="name">Name</Label>
                <Input
                  id="name"
                  v-model="formState.name"
                  placeholder="Your name"
                />
                <p v-if="errors.name" class="text-sm text-destructive">
                  {{ errors.name }}
                </p>
              </div>

              <!-- Email (read-only) -->
              <div class="space-y-2">
                <Label for="email">Email</Label>
                <Input
                  id="email"
                  :model-value="user?.email"
                  disabled
                  class="opacity-60"
                />
                <p class="text-xs text-muted-foreground">
                  Email cannot be changed. Contact support if you need to update it.
                </p>
              </div>

              <!-- Success / error messages -->
              <Alert v-if="successMessage" class="border-primary/20 bg-primary/5">
                <CheckCircle class="h-4 w-4 text-primary" />
                <AlertDescription>{{ successMessage }}</AlertDescription>
              </Alert>
              <Alert v-if="errorMessage" variant="destructive">
                <AlertCircle class="h-4 w-4" />
                <AlertDescription>{{ errorMessage }}</AlertDescription>
              </Alert>

              <Button type="submit" :disabled="submitting">
                <Loader2 v-if="submitting" class="mr-2 h-4 w-4 animate-spin" />
                Save changes
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-vue-next'
import { updateProfileSchema } from '@paisa/shared'
import type { AuthUser } from '@paisa/shared'

definePageMeta({
  middleware: 'auth',
})

useHead({ title: 'Profile Settings' })

const { user, apiFetch, fetchUser } = useAuth()

// ─── Form state ───
const formState = reactive({
  name: user.value?.name || '',
})

// Keep form in sync if user state updates (e.g. after refresh)
watch(() => user.value?.name, (newName) => {
  if (newName && !formState.name) {
    formState.name = newName
  }
})

const submitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const errors = reactive<Record<string, string>>({})

// ─── Helpers ───
const initials = computed(() => {
  const name = user.value?.name || user.value?.email || ''
  return name
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0].toUpperCase())
    .join('')
})

// ─── Client-side validation ───
function validate(): boolean {
  Object.keys(errors).forEach(key => delete errors[key])

  const result = updateProfileSchema.safeParse(formState)
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
  successMessage.value = ''

  try {
    const updated = await apiFetch<AuthUser>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ name: formState.name }),
      headers: { 'Content-Type': 'application/json' },
    })

    // Update local auth state so the header dropdown reflects the change
    if (user.value) {
      user.value = { ...user.value, name: updated.name }
    }

    successMessage.value = 'Profile updated successfully.'
  } catch (error: any) {
    errorMessage.value =
      error?.data?.error?.message
      || error?.message
      || 'Failed to update profile. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>
