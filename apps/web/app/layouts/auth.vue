<!--
  Auth Layout — used by login, register, forgot-password, etc.

  Stripe-inspired design: gradient background, centered card, clean footer.
  No navigation bar, no sidebar — just the auth form.

  Pages opt into this layout with:
    definePageMeta({ layout: 'auth' })
-->
<template>
  <div class="flex min-h-screen flex-col items-center justify-center px-4 auth-gradient">
    <!-- Logo + App Name -->
    <div class="mb-8 text-center">
      <h1 class="text-3xl font-bold tracking-tight text-foreground">
        Paisa
      </h1>
    </div>

    <!-- Auth card container — pages render here -->
    <div class="w-full max-w-sm">
      <slot />
    </div>

    <!-- Footer links -->
    <div class="mt-8 text-center text-xs text-muted-foreground">
      <NuxtLink to="/terms" class="hover:underline">
        Terms
      </NuxtLink>
      <span class="mx-2">&middot;</span>
      <NuxtLink to="/privacy" class="hover:underline">
        Privacy
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.auth-gradient {
  background:
    radial-gradient(ellipse at 20% 50%, oklch(0.95 0.02 250 / 40%) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, oklch(0.95 0.03 300 / 30%) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 100%, oklch(0.96 0.02 200 / 30%) 0%, transparent 50%),
    oklch(0.98 0.005 270);
}

:global(.dark) .auth-gradient {
  background:
    radial-gradient(ellipse at 20% 50%, oklch(0.25 0.03 250 / 30%) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, oklch(0.25 0.04 300 / 20%) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 100%, oklch(0.22 0.02 200 / 20%) 0%, transparent 50%),
    oklch(0.145 0 0);
}
</style>
