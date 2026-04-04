<!--
  Settings Index — redirects to /settings/profile.
  This ensures /settings always lands somewhere useful.
-->
<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

await navigateTo('/settings/profile', { redirectCode: 301 })
</script>
