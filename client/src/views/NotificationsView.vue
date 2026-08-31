<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationsStore } from '../stores/notifications.ts';
import { formatDate } from '../composables/format.ts';
import { useIosNavAction } from '../composables/ios-chrome.ts';
import UserAvatar from '../components/UserAvatar.vue';
import type { NotificationItem, NotificationKind } from '../types/index.ts';

const notifications = useNotificationsStore();
const router = useRouter();

useIosNavAction(computed(() => (
  notifications.unreadCount > 0
    ? {
      id: 'read-all',
      label: 'Прочитать',
      handler: () => {
        void notifications.markAllRead();
      },
    }
    : null
)));

function notificationTitle(item: NotificationItem): string {
  if (item.kind === 'card_overdue') {
    return 'Срок истек';
  }

  if (item.kind === 'card_due_soon') {
    return 'Срок на этой неделе';
  }

  return `${item.actorName || 'Участник'} ${notificationAction(item.kind)}`;
}

function notificationAction(kind: NotificationKind): string {
  if (kind === 'card_assigned') {
    return 'назначил вас исполнителем';
  }

  if (kind === 'comment_reply') {
    return 'ответил на ваш комментарий';
  }

  return 'прокомментировал карточку';
}

function notificationSubtitle(item: NotificationItem): string {
  const context = [item.projectName, item.cardTitle].filter(Boolean).join(' · ');

  if (item.detail) {
    return context ? `${context}: ${item.detail}` : item.detail;
  }

  return context;
}

async function openItem(item: NotificationItem): Promise<void> {
  await notifications.markRead(item.id);
  await router.push({
    name: 'project',
    params: { projectId: item.projectId },
    query: { card: item.cardId },
  });
}
</script>

<template>
  <section class="screen is-active">
    <div class="wrap">
      <p
        v-if="notifications.isLoading && !notifications.items.length"
        class="grouped-caption"
      >
        Загрузка…
      </p>
      <div
        v-else-if="notifications.items.length"
        class="grouped"
      >
        <div class="grouped-section">
          <button
            v-for="item in notifications.items"
            :key="item.id"
            type="button"
            class="list-row has-disclosure"
            :class="{ 'is-unread': !item.readAt }"
            @click="openItem(item)"
          >
            <UserAvatar
              v-if="item.actorId"
              :name="item.actorName || 'Участник'"
              :src="item.actorAvatarUrl"
            />
            <div class="grow">
              <div>{{ notificationTitle(item) }}</div>
              <div class="muted">
                {{ notificationSubtitle(item) }}
              </div>
            </div>
            <span class="muted">
              {{ formatDate(item.createdAt) }}
            </span>
          </button>
        </div>
      </div>
      <p
        v-else
        class="grouped-caption"
      >
        Нет уведомлений
      </p>
      <div
        v-if="notifications.hasMore"
        class="actions actions--start mt-16"
      >
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="notifications.isLoading"
          @click="notifications.loadMore"
        >
          Загрузить еще
        </button>
      </div>
    </div>
  </section>
</template>
