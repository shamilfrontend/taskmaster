<script setup lang="ts">
import {
  computed, onMounted, onUnmounted, ref,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';
import { useNotificationsStore } from '../stores/notifications.ts';
import { useBreadcrumbs } from '../composables/breadcrumbs.ts';
import NotificationsDrawer from './NotificationsDrawer.vue';
import ProductSwitcher from './ProductSwitcher.vue';
import UserAvatar from './UserAvatar.vue';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const notifications = useNotificationsStore();
const { crumbs } = useBreadcrumbs();
const menuOpen = ref(false);
const menuRef = ref<HTMLElement | null>(null);

const unreadLabel = computed(() => {
  if (notifications.unreadCount > 9) {
    return '9+';
  }

  return String(notifications.unreadCount);
});

function closeMenu(): void {
  menuOpen.value = false;
}

function toggleMenu(): void {
  menuOpen.value = !menuOpen.value;
}

function onDocumentClick(event: MouseEvent): void {
  const { target } = event;

  if (!(target instanceof Node) || !menuRef.value?.contains(target)) {
    closeMenu();
  }
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    closeMenu();
  }
}

async function logout(): Promise<void> {
  closeMenu();
  await auth.logout();
  await router.push({ name: 'landing' });
}

onMounted(() => {
  notifications.startPolling();
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onDocumentKeydown);
});

onUnmounted(() => {
  notifications.stopPolling();
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('keydown', onDocumentKeydown);
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
      TaskMaster
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
      <router-link
        :to="{ name: 'my-tasks' }"
        class="btn btn-ghost header-link"
        :class="{ 'is-open': route.name === 'my-tasks' }"
      >
        Мои задачи
      </router-link>
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
        class="btn btn-ghost header-link"
        @click="logout"
      >
        Выйти
      </button>
      <div
        ref="menuRef"
        class="header-menu"
      >
        <button
          type="button"
          class="header-menu-btn"
          :class="{ 'is-open': menuOpen }"
          aria-label="Меню"
          :aria-expanded="menuOpen"
          @click="toggleMenu"
        >
          ⋯
        </button>
        <div
          v-if="menuOpen"
          class="header-menu-list"
          role="menu"
        >
          <router-link
            :to="{ name: 'my-tasks' }"
            class="header-menu-item"
            :class="{ 'is-open': route.name === 'my-tasks' }"
            role="menuitem"
            @click="closeMenu"
          >
            Мои задачи
          </router-link>
          <button
            type="button"
            class="header-menu-item"
            role="menuitem"
            @click="logout"
          >
            Выйти
          </button>
        </div>
      </div>
    </div>
  </header>
  <NotificationsDrawer />
</template>

<style lang="scss" scoped>
@use '../assets/breakpoints' as *;

.app-header {
  display: flex;
  align-items: center;
  gap: 4px;
  height: var(--header-h);
  padding: 0 calc(12px + env(safe-area-inset-right, 0px))
    0 calc(16px + env(safe-area-inset-left, 0px));
  background: #1f1f21;
  border-bottom: 0;
  color: #fff;

  &.is-visible {
    display: flex;
  }

  .btn-ghost {
    color: #fff;
    font-size: 16px;
    text-decoration: none;

    &:hover:not(:disabled),
    &.is-open {
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
    width: 34px;
    height: 34px;
    border-radius: 6px;
    background: none;
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

.header-menu {
  display: none;
  position: relative;
}

.header-menu-btn {
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
  font-size: 18px;
  line-height: 1;

  &:hover,
  &.is-open {
    background: rgb(255 255 255 / 20%);
  }
}

.header-menu-list {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 80;
  min-width: 180px;
  padding: 4px;
  background: #282e33;
  border-radius: var(--radius);
  box-shadow: 0 8px 16px #091e4240;
}

.header-menu-item {
  display: block;
  width: 100%;
  border: 0;
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  background: none;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  text-decoration: none;

  &:hover,
  &.is-open {
    background: rgb(255 255 255 / 12%);
  }
}

@media (max-width: $bp-tablet) {
  .app-header {
    gap: 2px;
  }

  .crumbs {
    display: none;
  }
}

@media (max-width: $bp-phone) {
  .header-link {
    display: none;
  }

  .header-menu {
    display: block;
  }
}
</style>
