<!--
  Landing Page (/)

  Public page — no auth required.
  In a real app, this would be a full marketing/landing page.
  For the boilerplate, it's a simple hero that links to login/register.
-->
<template>
  <div class="flex min-h-screen flex-col bg-background">
    <!-- Navigation -->
    <header class="border-b border-border">
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <span class="text-xl font-bold text-foreground">Paisa</span>
        <div class="flex items-center gap-3">
          <Button variant="ghost" as-child>
            <NuxtLink to="/auth/login">Sign in</NuxtLink>
          </Button>
          <Button as-child>
            <NuxtLink to="/auth/register">Get started</NuxtLink>
          </Button>
        </div>
      </div>
    </header>

    <!-- Hero -->
    <main class="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <h1 class="max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
        Ship faster, build better
      </h1>
      <p class="mt-6 max-w-xl text-lg text-muted-foreground">
        A production-ready SaaS boilerplate with authentication, billing,
        email, and everything you need to launch your next product.
      </p>
      <div class="mt-10 flex flex-col items-center gap-4 sm:flex-row">
        <Button size="lg" as-child>
          <NuxtLink to="/auth/register">Get started</NuxtLink>
        </Button>
        <Button size="lg" variant="outline" as-child>
          <NuxtLink to="/auth/login">Sign in</NuxtLink>
        </Button>
      </div>
    </main>

    <!-- Footer -->
    <footer class="border-t border-border py-8 text-center text-sm text-muted-foreground">
      <p>&copy; {{ new Date().getFullYear() }} Paisa. All rights reserved.</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false, // Full-page layout, no wrapper
})

useHead({
  title: 'Paisa — Ship faster, build better',
})
</script>
