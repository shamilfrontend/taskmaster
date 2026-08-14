<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';
import { useBreadcrumbs } from '../composables/breadcrumbs.ts';
import { initials } from '../composables/format.ts';

const router = useRouter();
const auth = useAuthStore();
const { crumbs } = useBreadcrumbs();

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
    <nav class="crumbs">
      <template v-for="(crumb, index) in crumbs" :key="`${crumb.label}-${index}`">
        <span v-if="index > 0" class="sep">/</span>
        <router-link v-if="crumb.to" :to="crumb.to">{{ crumb.label }}</router-link>
        <span v-else class="current">{{ crumb.label }}</span>
      </template>
    </nav>
    <div class="header-right">
      <span v-if="auth.user" class="avatar" :title="auth.user.displayName">
        {{ initials(auth.user.displayName) }}
      </span>
      <button type="button" class="btn btn-ghost" @click="logout">Выйти</button>
    </div>
  </header>
</template>
