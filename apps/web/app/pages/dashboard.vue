<!--
  Dashboard Page — the main landing page for authenticated users.

  Protected by the auth middleware — unauthenticated users are
  redirected to /auth/login.

  This is a placeholder that will be expanded with real content
  (stats, recent activity, quick actions) as features are built.
-->
<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-foreground">
        Dashboard
      </h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Welcome back{{ user?.name ? `, ${user.name}` : '' }}!
      </p>
    </div>

    <!-- Placeholder cards — replace with real widgets -->
    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <!-- Profile Card -->
      <Card>
        <CardHeader>
          <div class="flex items-center gap-2">
            <UserIcon class="h-5 w-5 text-primary" />
            <CardTitle class="text-base">Profile</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <dl class="space-y-3 text-sm">
            <div>
              <dt class="text-muted-foreground">Email</dt>
              <dd class="font-medium">{{ user?.email }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Role</dt>
              <dd class="font-medium capitalize">{{ user?.role?.toLowerCase() }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Email verified</dt>
              <dd>
                <Badge :variant="user?.emailVerified ? 'default' : 'secondary'">
                  {{ user?.emailVerified ? 'Verified' : 'Not verified' }}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <!-- Security Card -->
      <Card>
        <CardHeader>
          <div class="flex items-center gap-2">
            <Shield class="h-5 w-5 text-primary" />
            <CardTitle class="text-base">Security</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <dl class="space-y-3 text-sm">
            <div>
              <dt class="text-muted-foreground">Two-factor auth</dt>
              <dd>
                <Badge :variant="user?.has2FA ? 'default' : 'outline'">
                  {{ user?.has2FA ? 'Enabled' : 'Disabled' }}
                </Badge>
              </dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Passkeys</dt>
              <dd>
                <Badge :variant="user?.hasPasskey ? 'default' : 'outline'">
                  {{ user?.hasPasskey ? 'Configured' : 'Not set up' }}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <!-- Getting Started Card -->
      <Card>
        <CardHeader>
          <div class="flex items-center gap-2">
            <Rocket class="h-5 w-5 text-primary" />
            <CardTitle class="text-base">Getting Started</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground">
            This is your dashboard. Replace these cards with your app's
            real content — stats, activity feeds, quick actions.
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Rocket, Shield, User as UserIcon } from 'lucide-vue-next'

definePageMeta({
  middleware: 'auth',
})

useHead({ title: 'Dashboard' })

const { user } = useAuth()
</script>
