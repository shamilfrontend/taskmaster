<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';
import { initials } from '../composables/format.ts';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const crumbs = computed(() => {
  const extra = route.meta.crumb;
  return typeof extra === 'string' ? extra : '';
});

async function logout(): Promise<void> {
  await auth.logout();
  await router.push({ name: 'login' });
}
</script>

<template>
  <header class="app-header is-visible">
    <button type="button" class="brand" @click="router.push({ name: 'teams' })">
      <img src="/logo/kanban.svg" alt="">
      Taskmaster
    </button>
    <nav class="crumbs">{{ crumbs }}</nav>
    <div class="header-right">
      <span v-if="auth.user" class="avatar" :title="auth.user.displayName">
        {{ initials(auth.user.displayName) }}
      </span>
      <button type="button" class="btn btn-ghost" @click="logout">Выйти</button>
    </div>
  </header>
</template>
