<!--
  Profile Settings Page

  Edit name, view email (read-only), upload avatar.
  Uses PATCH /users/me to update the profile.
  Uses POST /users/me/avatar for avatar upload (multipart/form-data).
  Uses DELETE /users/me/avatar to remove avatar.
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
              <!-- Avatar with upload -->
              <div class="flex items-center gap-4">
                <div class="relative group">
                  <Avatar class="h-16 w-16">
                    <AvatarImage
                      v-if="avatarPreview || user?.avatarUrl"
                      :src="avatarPreview || resolveAvatarUrl(user?.avatarUrl)"
                      :alt="user?.name || ''"
                    />
                    <AvatarFallback class="text-lg">
                      {{ initials }}
                    </AvatarFallback>
                  </Avatar>

                  <!--
                    Overlay button — appears on hover.
                    This is a label wrapping a hidden file input.
                    When you click the label, it triggers the file input.
                  -->
                  <label
                    class="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                    :class="{ 'pointer-events-none': avatarUploading }"
                  >
                    <Camera v-if="!avatarUploading" class="h-5 w-5 text-white" />
                    <Loader2 v-else class="h-5 w-5 animate-spin text-white" />

                    <!--
                      Hidden file input.
                      accept="image/*" restricts the file picker to images.
                      @change fires when the user picks a file.
                    -->
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      class="hidden"
                      :disabled="avatarUploading"
                      @change="onAvatarSelected"
                    />
                  </label>
                </div>

                <div class="flex-1">
                  <p class="text-sm font-medium text-foreground">
                    {{ user?.name || user?.email }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    Click the avatar to upload a new photo
                  </p>

                  <!-- Remove avatar button (only shown if there's an avatar) -->
                  <button
                    v-if="user?.avatarUrl && !avatarUploading"
                    type="button"
                    class="mt-1 text-xs text-destructive hover:underline"
                    @click="onRemoveAvatar"
                  >
                    Remove photo
                  </button>
                </div>
              </div>

              <!-- Avatar error message -->
              <Alert v-if="avatarError" variant="destructive">
                <AlertCircle class="h-4 w-4" />
                <AlertDescription>{{ avatarError }}</AlertDescription>
              </Alert>

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
import { AlertCircle, Camera, CheckCircle, Loader2 } from 'lucide-vue-next'
import { updateProfileSchema } from '@paisa/shared'
import type { AuthUser } from '@paisa/shared'

definePageMeta({
  middleware: 'auth',
})

useHead({ title: 'Profile Settings' })

const runtimeConfig = useRuntimeConfig()
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

// ─── Avatar state ───
const avatarUploading = ref(false)
const avatarError = ref('')
const avatarPreview = ref('') // Data URL for instant preview before upload completes

/**
 * Resolve avatar URL for display.
 *
 * Local storage URLs are relative paths like "/uploads/avatars/uuid.jpg".
 * We need to prepend the API base URL so the browser can fetch them.
 * External URLs (Google avatars, R2 CDN) are already absolute — used as-is.
 */
function resolveAvatarUrl(url?: string | null): string {
  if (!url) return ''
  // Already an absolute URL (Google avatar, R2 CDN, etc.)
  if (url.startsWith('http')) return url
  // Local storage — prepend API URL
  const apiBase = runtimeConfig.public.apiBaseUrl || 'http://localhost:3001'
  return `${apiBase}${url}`
}

// ─── Helpers ───
const initials = computed(() => {
  const name = user.value?.name || user.value?.email || ''
  return name
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]!.toUpperCase())
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

// ─── Avatar upload handler ───
/**
 * Called when the user picks a file from the file input.
 *
 * How it works:
 * 1. Read the selected file from the input event
 * 2. Show an instant preview using FileReader (no network yet!)
 * 3. Build a FormData object (the web standard for multipart file uploads)
 * 4. POST it to /users/me/avatar
 * 5. Update the auth state with the new avatar URL
 */
async function onAvatarSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  // Reset the input so the same file can be re-selected
  input.value = ''

  // Client-side validation (matches server-side constraints)
  const maxSize = 2 * 1024 * 1024 // 2 MB
  if (file.size > maxSize) {
    avatarError.value = 'File too large. Maximum size is 2 MB.'
    return
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    avatarError.value = 'Invalid file type. Use JPEG, PNG, WebP, or GIF.'
    return
  }

  avatarError.value = ''
  avatarUploading.value = true

  // Show instant preview while uploading
  // FileReader reads the file as a data: URL (base64 embedded in the page)
  const reader = new FileReader()
  reader.onload = (e) => {
    avatarPreview.value = e.target?.result as string
  }
  reader.readAsDataURL(file)

  try {
    /**
     * FormData is the web standard for sending files over HTTP.
     * It creates a multipart/form-data request body.
     *
     * We append the file under the key "file" — this must match
     * the @FileInterceptor('file') on the server side.
     *
     * Note: We do NOT set Content-Type header manually!
     * The browser automatically sets it to "multipart/form-data"
     * with the correct boundary string when it sees FormData.
     */
    const formData = new FormData()
    formData.append('file', file)

    const updated = await apiFetch<AuthUser>('/users/me/avatar', {
      method: 'POST',
      body: formData,
      // No Content-Type header! Browser sets it automatically for FormData
    })

    // Update local auth state
    if (user.value) {
      user.value = { ...user.value, avatarUrl: updated.avatarUrl }
    }

    // Clear the preview (the real URL from the server is now in user.avatarUrl)
    avatarPreview.value = ''
  } catch (error: any) {
    avatarError.value =
      error?.data?.error?.message
      || error?.message
      || 'Failed to upload avatar.'
    avatarPreview.value = '' // Revert preview on error
  } finally {
    avatarUploading.value = false
  }
}

// ─── Avatar remove handler ───
async function onRemoveAvatar() {
  avatarError.value = ''
  avatarUploading.value = true

  try {
    const updated = await apiFetch<AuthUser>('/users/me/avatar', {
      method: 'DELETE',
    })

    if (user.value) {
      user.value = { ...user.value, avatarUrl: updated.avatarUrl }
    }

    avatarPreview.value = ''
  } catch (error: any) {
    avatarError.value =
      error?.data?.error?.message
      || error?.message
      || 'Failed to remove avatar.'
  } finally {
    avatarUploading.value = false
  }
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
