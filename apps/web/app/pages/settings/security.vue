<!--
  Security Settings Page

  - Change password (uses existing POST /auth/change-password)
  - Connected accounts (shows OAuth status)
  - Delete account (destructive, requires password confirmation via dialog)
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
        <!-- Change Password -->
        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>
              Update your password. You'll need your current password to confirm.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form class="space-y-4" novalidate @submit.prevent="onChangePassword">
              <div class="space-y-2">
                <Label for="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  v-model="passwordForm.currentPassword"
                  type="password"
                  placeholder="Enter current password"
                />
                <p v-if="passwordErrors.currentPassword" class="text-sm text-destructive">
                  {{ passwordErrors.currentPassword }}
                </p>
              </div>

              <div class="space-y-2">
                <Label for="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  v-model="passwordForm.newPassword"
                  type="password"
                  placeholder="Enter new password"
                />
                <p v-if="passwordErrors.newPassword" class="text-sm text-destructive">
                  {{ passwordErrors.newPassword }}
                </p>
                <p class="text-xs text-muted-foreground">
                  At least 8 characters with uppercase, lowercase, and a number.
                </p>
              </div>

              <Alert v-if="passwordSuccess" class="border-primary/20 bg-primary/5">
                <CheckCircle class="h-4 w-4 text-primary" />
                <AlertDescription>{{ passwordSuccess }}</AlertDescription>
              </Alert>
              <Alert v-if="passwordError" variant="destructive">
                <AlertCircle class="h-4 w-4" />
                <AlertDescription>{{ passwordError }}</AlertDescription>
              </Alert>

              <Button type="submit" :disabled="passwordSubmitting">
                <Loader2 v-if="passwordSubmitting" class="mr-2 h-4 w-4 animate-spin" />
                Update password
              </Button>
            </form>
          </CardContent>
        </Card>

        <!-- Connected Accounts -->
        <Card>
          <CardHeader>
            <CardTitle>Connected accounts</CardTitle>
            <CardDescription>
              Manage your sign-in methods.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div class="flex items-center justify-between rounded-md border border-border p-4">
              <div class="flex items-center gap-3">
                <!-- Google icon -->
                <svg class="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                <div>
                  <p class="text-sm font-medium">Google</p>
                  <p class="text-xs text-muted-foreground">
                    Sign in with your Google account
                  </p>
                </div>
              </div>
              <Badge variant="outline">
                Available
              </Badge>
            </div>
            <p class="mt-3 text-xs text-muted-foreground">
              Link and unlink accounts feature coming soon.
            </p>
          </CardContent>
        </Card>

        <!-- Danger Zone -->
        <Card class="border-destructive/30">
          <CardHeader>
            <CardTitle class="text-destructive">Danger zone</CardTitle>
            <CardDescription>
              Permanently delete your account and all associated data.
              This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog v-model:open="deleteDialogOpen">
              <DialogTrigger as-child>
                <Button variant="destructive">
                  Delete account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete your account?</DialogTitle>
                  <DialogDescription>
                    This will permanently delete your account, profile, and all
                    associated data. This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>

                <form class="space-y-4" novalidate @submit.prevent="onDeleteAccount">
                  <div class="space-y-2">
                    <Label for="deletePassword">Enter your password to confirm</Label>
                    <Input
                      id="deletePassword"
                      v-model="deleteForm.password"
                      type="password"
                      placeholder="Your password"
                    />
                    <p v-if="deleteErrors.password" class="text-sm text-destructive">
                      {{ deleteErrors.password }}
                    </p>
                  </div>

                  <Alert v-if="deleteError" variant="destructive">
                    <AlertCircle class="h-4 w-4" />
                    <AlertDescription>{{ deleteError }}</AlertDescription>
                  </Alert>

                  <DialogFooter>
                    <DialogClose as-child>
                      <Button variant="outline" type="button">
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button
                      variant="destructive"
                      type="submit"
                      :disabled="deleteSubmitting"
                    >
                      <Loader2 v-if="deleteSubmitting" class="mr-2 h-4 w-4 animate-spin" />
                      Delete my account
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-vue-next'
import { changePasswordSchema, deleteAccountSchema } from '@paisa/shared'

definePageMeta({
  middleware: 'auth',
})

useHead({ title: 'Security Settings' })

const { apiFetch, clearAuth } = useAuth()

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Change Password
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
})

const passwordSubmitting = ref(false)
const passwordError = ref('')
const passwordSuccess = ref('')
const passwordErrors = reactive<Record<string, string>>({})

function validatePassword(): boolean {
  Object.keys(passwordErrors).forEach(key => delete passwordErrors[key])

  const result = changePasswordSchema.safeParse(passwordForm)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as string
      if (!passwordErrors[field]) {
        passwordErrors[field] = issue.message
      }
    }
    return false
  }
  return true
}

async function onChangePassword() {
  if (!validatePassword()) return

  passwordSubmitting.value = true
  passwordError.value = ''
  passwordSuccess.value = ''

  try {
    await apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(passwordForm),
      headers: { 'Content-Type': 'application/json' },
    })

    passwordSuccess.value = 'Password changed successfully.'
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
  } catch (error: any) {
    passwordError.value =
      error?.data?.error?.message
      || error?.message
      || 'Failed to change password. Please check your current password.'
  } finally {
    passwordSubmitting.value = false
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Delete Account
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const deleteDialogOpen = ref(false)
const deleteForm = reactive({ password: '' })
const deleteSubmitting = ref(false)
const deleteError = ref('')
const deleteErrors = reactive<Record<string, string>>({})

function validateDelete(): boolean {
  Object.keys(deleteErrors).forEach(key => delete deleteErrors[key])

  const result = deleteAccountSchema.safeParse(deleteForm)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as string
      if (!deleteErrors[field]) {
        deleteErrors[field] = issue.message
      }
    }
    return false
  }
  return true
}

async function onDeleteAccount() {
  if (!validateDelete()) return

  deleteSubmitting.value = true
  deleteError.value = ''

  try {
    await apiFetch('/users/me', {
      method: 'DELETE',
      body: JSON.stringify(deleteForm),
      headers: { 'Content-Type': 'application/json' },
    })

    // Account is gone — clear auth state and redirect to home
    clearAuth()
    await navigateTo('/')
  } catch (error: any) {
    deleteError.value =
      error?.data?.error?.message
      || error?.message
      || 'Failed to delete account. Please check your password.'
  } finally {
    deleteSubmitting.value = false
  }
}

// Reset delete dialog state when closed
watch(deleteDialogOpen, (open) => {
  if (!open) {
    deleteForm.password = ''
    deleteError.value = ''
    Object.keys(deleteErrors).forEach(key => delete deleteErrors[key])
  }
})
</script>
