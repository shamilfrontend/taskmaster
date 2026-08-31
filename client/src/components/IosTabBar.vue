<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useNotificationsStore } from '../stores/notifications.ts';

const route = useRoute();
const notifications = useNotificationsStore();

const PROJECT_NAMES = new Set([
  'project',
  'project-releases',
  'project-settings',
  'project-members',
  'analytics',
  'release',
]);

const activeTab = computed(() => {
  const { name } = route;

  if (name === 'my-tasks') {
    return 'tasks';
  }

  if (name === 'notifications') {
    return 'notifications';
  }

  if (name === 'more') {
    return 'more';
  }

  if (
    name === 'teams'
    || name === 'team'
    || (typeof name === 'string' && PROJECT_NAMES.has(name))
  ) {
    return 'teams';
  }

  return 'teams';
});

const unreadLabel = computed(() => {
  if (notifications.unreadCount > 9) {
    return '9+';
  }

  return String(notifications.unreadCount);
});
</script>

<template>
  <nav
    class="ios-tab-bar"
    aria-label="Основная навигация"
  >
    <router-link
      :to="{ name: 'teams' }"
      class="ios-tab"
      :class="{ 'is-active': activeTab === 'teams' }"
    >
      <svg
        class="ios-tab-icon"
        viewBox="0 0 28 28"
        aria-hidden="true"
      >
        <path
          d="M4 11.5 14 4l10 7.5V23a1 1 0 0 1-1 1h-6.5v-7h-5v7H5a1 1 0 0 1-1-1V11.5Z"
          fill="currentColor"
        />
      </svg>
      <span>Команды</span>
    </router-link>
    <router-link
      :to="{ name: 'my-tasks' }"
      class="ios-tab"
      :class="{ 'is-active': activeTab === 'tasks' }"
    >
      <svg
        class="ios-tab-icon"
        viewBox="0 0 28 28"
        aria-hidden="true"
      >
        <rect
          x="5"
          y="4"
          width="18"
          height="20"
          rx="2"
          fill="currentColor"
        />
        <path
          d="M9 10h10M9 14h10M9 18h6"
          stroke="#111"
          stroke-width="1.6"
          stroke-linecap="round"
          opacity="0.45"
        />
      </svg>
      <span>Задачи</span>
    </router-link>
    <router-link
      :to="{ name: 'notifications' }"
      class="ios-tab"
      :class="{ 'is-active': activeTab === 'notifications' }"
    >
      <span class="ios-tab-icon-wrap">
        <svg
          class="ios-tab-icon"
          viewBox="0 0 28 28"
          aria-hidden="true"
        >
          <path
            d="M14 24a2.4 2.4 0 0 0 2.3-1.8h-4.6A2.4 2.4 0 0 0 14 24Zm8.2-7.2V11a8.2 8.2 0 1 0-16.4 0v5.8L4 20.4V22h20v-1.6l-1.8-3.6Z"
            fill="currentColor"
          />
        </svg>
        <span
          v-if="notifications.unreadCount > 0"
          class="ios-tab-badge"
        >{{ unreadLabel }}</span>
      </span>
      <span>Уведомления</span>
    </router-link>
    <router-link
      :to="{ name: 'more' }"
      class="ios-tab"
      :class="{ 'is-active': activeTab === 'more' }"
    >
      <svg
        class="ios-tab-icon"
        viewBox="0 0 28 28"
        aria-hidden="true"
      >
        <circle
          cx="7"
          cy="14"
          r="2.2"
          fill="currentColor"
        />
        <circle
          cx="14"
          cy="14"
          r="2.2"
          fill="currentColor"
        />
        <circle
          cx="21"
          cy="14"
          r="2.2"
          fill="currentColor"
        />
      </svg>
      <span>Ещё</span>
    </router-link>
  </nav>
</template>

<style lang="scss" scoped>
.ios-tab-bar {
  z-index: 30;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  height: calc(var(--tab-h) + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  border-top: 1px solid #000;
  background-image:
    linear-gradient(
      to bottom,
      rgb(255 255 255 / 16%) 0,
      rgb(255 255 255 / 4%) 18%,
      transparent 40%
    ),
    linear-gradient(to bottom, #454545 0%, #2a2a2a 8%, #141414 48%, #000 52%, #000 100%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 18%);
}

.ios-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 0;
  padding: 4px 2px 3px;
  color: #989898;
  font-size: 10px;
  font-weight: 700;
  text-decoration: none;
  text-shadow: 0 -1px 0 #000;

  &.is-active {
    color: #fff;
    text-shadow: 0 0 8px #6ea8ff, 0 -1px 0 #000;

    .ios-tab-icon {
      filter: drop-shadow(0 0 6px #6ea8ff);
      color: #7eb6ff;
    }
  }
}

.ios-tab-icon-wrap {
  position: relative;
  display: inline-flex;
}

.ios-tab-icon {
  width: 24px;
  height: 24px;
}

.ios-tab-badge {
  position: absolute;
  top: -4px;
  right: -10px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border: 1px solid #7a120c;
  border-radius: 8px;
  background-image: linear-gradient(to bottom, #ff6b5b, #d32016 55%, #a80f0a);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 45%);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  line-height: 14px;
  text-align: center;
  text-shadow: 0 -1px 0 rgb(0 0 0 / 4%);
}
</style>
