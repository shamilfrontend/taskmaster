<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';
import { useNotificationsStore } from '../stores/notifications.ts';
import { useBreadcrumbs } from '../composables/breadcrumbs.ts';
import NotificationsDrawer from './NotificationsDrawer.vue';
import ProductSwitcher from './ProductSwitcher.vue';
import UserAvatar from './UserAvatar.vue';

const router = useRouter();
const auth = useAuthStore();
const notifications = useNotificationsStore();
const { crumbs } = useBreadcrumbs();

const unreadLabel = computed(() => {
  if (notifications.unreadCount > 9) {
    return '9+';
  }

  return String(notifications.unreadCount);
});

async function logout(): Promise<void> {
  await auth.logout();
  await router.push({ name: 'landing' });
}

onMounted(() => {
  notifications.startPolling();
});

onUnmounted(() => {
  notifications.stopPolling();
});
</script>

<template>
  <header class="app-header is-visible">
    <ProductSwitcher />
    <button
      type="button"
      class="brand"
      @click="router.push({ name: 'teams' })"
    >
      <img
        src="/logo/kanban.svg"
        alt=""
      >
      Taskmaster
    </button>
    <nav
      v-if="crumbs.length > 0"
      class="crumbs"
    >
      <template
        v-for="(crumb, index) in crumbs"
        :key="`${crumb.label}-${index}`"
      >
        <span class="sep">/</span>
        <router-link
          v-if="crumb.to"
          :to="crumb.to"
        >
          {{ crumb.label }}
        </router-link>
        <span
          v-else
          class="current"
        >{{ crumb.label }}</span>
      </template>
    </nav>
    <div class="header-right">
      <button
        type="button"
        class="bell-btn"
        :class="{ 'is-open': notifications.isOpen }"
        aria-label="Уведомления"
        :aria-expanded="notifications.isOpen"
        @click="notifications.toggleDrawer"
      >
        <svg
          class="bell-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm8-6V11a8 8 0 1 0-16 0v5l-2 2v1h20v-1l-2-2Z"
            fill="currentColor"
          />
        </svg>
        <span
          v-if="notifications.unreadCount > 0"
          class="bell-badge"
          aria-hidden="true"
        >
          {{ unreadLabel }}
        </span>
      </button>
      <UserAvatar
        v-if="auth.user"
        :name="auth.user.displayName"
        :src="auth.user.avatarUrl"
      />
      <button
        type="button"
        class="btn btn-ghost"
        @click="logout"
      >
        Выйти
      </button>
    </div>
  </header>
  <NotificationsDrawer />
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
    font-size: 16px;

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
  font-size: 16px;

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
  font-size: 16px;

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

.bell-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: var(--radius-sm);
  padding: 0;
  background: none;
  color: #fff;

  &:hover,
  &.is-open {
    background: rgb(255 255 255 / 20%);
  }
}

.bell-icon {
  width: 18px;
  height: 18px;
}

.bell-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--danger);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
}
</style>
