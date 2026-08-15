<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';
import { useBreadcrumbs } from '../composables/breadcrumbs.ts';
import { initials } from '../composables/format.ts';
import ProductSwitcher from './ProductSwitcher.vue';

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
    <ProductSwitcher />
    <button type="button" class="brand" @click="router.push({ name: 'teams' })">
      <img src="/logo/kanban.svg" alt="">
      Taskmaster
    </button>
    <nav v-if="crumbs.length > 0" class="crumbs">
      <template v-for="(crumb, index) in crumbs" :key="`${crumb.label}-${index}`">
        <span class="sep">/</span>
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

<style lang="scss" scoped>
.app-header {
  display: flex;
  align-items: center;
  gap: 4px;
  height: var(--header-h);
  padding: 0 12px 0 16px;
  background: #1f1f21;
  border-bottom: 0;
  color: #fff;

  &.is-visible {
    display: flex;
  }

  .btn-ghost {
    color: #fff;

    &:hover:not(:disabled) {
      background: rgb(255 255 255 / 20%);
    }
  }

  .avatar {
    box-shadow: 0 0 0 2px rgb(255 255 255 / 40%);
  }
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  border: 0;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  background: none;
  color: #fff;
  font-weight: 600;
  font-size: 14px;

  &:hover {
    background: rgb(255 255 255 / 20%);
  }

  img {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: #fff;
  }
}

.crumbs {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
  color: rgb(255 255 255 / 80%);
  font-size: 14px;

  a,
  button {
    border: 0;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    background: none;
    color: rgb(255 255 255 / 80%);
    text-decoration: none;
    white-space: nowrap;

    &:hover {
      background: rgb(255 255 255 / 20%);
      color: #fff;
    }
  }

  .sep {
    color: rgb(255 255 255 / 50%);
    flex-shrink: 0;
  }

  .current {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 2px 6px;
    color: #fff;
  }
}

.header-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
</style>
