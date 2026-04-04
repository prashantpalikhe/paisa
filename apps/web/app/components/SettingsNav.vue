<!--
  Settings Sidebar Navigation

  Shared sidebar for all /settings/* pages.
  Highlights the active link based on the current route.
  Responsive: vertical sidebar on desktop, horizontal on mobile.
-->
<template>
  <nav class="flex overflow-x-auto gap-1 sm:flex-col sm:overflow-x-visible" aria-label="Settings navigation">
    <NuxtLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors"
      :class="[
        isActive(item.to)
          ? 'bg-secondary text-foreground'
          : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
      ]"
    >
      <component :is="item.icon" class="h-4 w-4" />
      {{ item.label }}
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { CreditCard, User, Shield } from 'lucide-vue-next'

const route = useRoute()
const { appConfig } = useFeatureFlags()

const items = computed(() => {
  const base = [
    { to: '/settings/profile', label: 'Profile', icon: User },
    { to: '/settings/security', label: 'Security', icon: Shield },
  ]

  if (appConfig.value.features.stripe) {
    base.push({ to: '/settings/billing', label: 'Billing', icon: CreditCard })
  }

  return base
})

function isActive(path: string): boolean {
  return route.path === path
}
</script>
