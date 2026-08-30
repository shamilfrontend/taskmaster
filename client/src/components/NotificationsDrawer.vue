<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationsStore } from '../stores/notifications.ts';
import { formatDate } from '../composables/format.ts';
import UserAvatar from './UserAvatar.vue';
import type { NotificationItem, NotificationKind } from '../types/index.ts';

const notifications = useNotificationsStore();
const router = useRouter();

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
  notifications.closeDrawer();
  await router.push({
    name: 'project',
    params: { projectId: item.projectId },
    query: { card: item.cardId },
  });
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    notifications.closeDrawer();
  }
}

onMounted(() => {
  document.addEventListener('keydown', onDocumentKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', onDocumentKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div
      class="drawer-overlay"
      :class="{ 'is-open': notifications.isOpen }"
      @click.self="notifications.closeDrawer"
    >
      <aside
        class="drawer"
        role="dialog"
        aria-label="Уведомления"
      >
        <div class="drawer-head">
          <h2>Уведомления</h2>
          <div class="drawer-head-actions">
            <button
              v-if="notifications.unreadCount > 0"
              type="button"
              class="btn btn-ghost"
              @click="notifications.markAllRead"
            >
              Прочитать все
            </button>
            <button
              type="button"
              class="icon-btn"
              aria-label="Закрыть"
              @click="notifications.closeDrawer"
            >
              ×
            </button>
          </div>
        </div>
        <div class="drawer-body">
          <p
            v-if="notifications.isLoading && !notifications.items.length"
            class="muted"
          >
            Загрузка…
          </p>
          <template v-else>
            <button
              v-for="item in notifications.items"
              :key="item.id"
              type="button"
              class="list-row notification-row"
              :class="{ 'is-unread': !item.readAt }"
              @click="openItem(item)"
            >
              <UserAvatar
                v-if="item.actorId"
                :name="item.actorName || 'Участник'"
                :src="item.actorAvatarUrl"
              />
              <div class="grow">
                <div>
                  {{ notificationTitle(item) }}
                </div>
                <div class="muted">
                  {{ notificationSubtitle(item) }}
                </div>
              </div>
              <span class="muted notification-date">
                {{ formatDate(item.createdAt) }}
              </span>
            </button>
            <p
              v-if="!notifications.items.length"
              class="muted empty"
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
          </template>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
@use '../assets/breakpoints' as *;

.drawer-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 70;
  justify-content: flex-end;
  background: rgb(9 30 66 / 40%);

  &.is-open {
    display: flex;
  }
}

.drawer {
  display: flex;
  flex-direction: column;
  width: min(420px, 100%);
  height: 100%;
  background: var(--surface);
  box-shadow: -8px 0 24px #091e4226;
}

.drawer-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: 16px 16px 12px;

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
}

.drawer-head-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.drawer-body {
  flex: 1;
  overflow: auto;
  padding: 0 8px 16px;
}

.notification-row {
  align-items: flex-start;

  &.is-unread {
    background: var(--selected);
  }
}

.notification-date {
  flex-shrink: 0;
  white-space: nowrap;
}

.empty {
  padding: 24px 8px;
  text-align: center;
}

@media (max-width: $bp-phone) {
  .drawer {
    width: 100%;
  }

  .notification-row {
    flex-direction: column;
    align-items: stretch;
  }

  .notification-date {
    white-space: normal;
  }
}
</style>
