<!--
  Default Layout — used by all authenticated/protected pages.

  Has a navigation header with:
  - App logo/name (links to dashboard)
  - User dropdown menu (profile info + logout)

  Pages use this layout by default (no definePageMeta needed),
  or explicitly with: definePageMeta({ layout: 'default' })
-->
<template>
  <div class="min-h-screen bg-background">
    <!-- Navigation Header -->
    <header class="border-b border-border bg-card">
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <!-- Left: Logo -->
        <NuxtLink to="/dashboard" class="flex items-center gap-2">
          <span class="text-xl font-bold text-foreground">Paisa</span>
        </NuxtLink>

        <!-- Right: User dropdown -->
        <DropdownMenu v-if="user">
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" class="gap-2">
              <User class="h-4 w-4" />
              <span>{{ user.name || user.email }}</span>
              <ChevronDown class="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuLabel>
              {{ user.email }}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem as-child>
              <NuxtLink to="/dashboard" class="flex items-center gap-2">
                <LayoutDashboard class="h-4 w-4" />
                Dashboard
              </NuxtLink>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem class="gap-2" @click="logout">
              <LogOut class="h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <!-- Loading state while auth is resolving -->
        <div v-else class="h-8 w-24 animate-pulse rounded-md bg-muted" />
      </div>
    </header>

    <!-- Page content -->
    <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ChevronDown, LayoutDashboard, LogOut, User } from 'lucide-vue-next'

const { user, logout } = useAuth()
</script>
