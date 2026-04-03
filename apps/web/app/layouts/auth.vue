<!--
  Auth Layout — used by login, register, forgot-password, etc.

  Simple centered layout with the app logo above a card.
  No navigation bar, no sidebar — just the auth form.

  Pages opt into this layout with:
    definePageMeta({ layout: 'auth' })
-->
<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-background px-4">
    <!-- Logo + App Name -->
    <div class="mb-8 text-center">
      <h1 class="text-3xl font-bold tracking-tight text-foreground">
        Paisa
      </h1>
      <p class="mt-2 text-sm text-muted-foreground">
        Ship faster, build better
      </p>
    </div>

    <!-- Auth card container — pages render here -->
    <div class="w-full max-w-md">
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
