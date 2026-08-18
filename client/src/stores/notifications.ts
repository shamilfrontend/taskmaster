import { acceptHMRUpdate, defineStore } from 'pinia';
import { ref } from 'vue';
import { http, errorMessage, toastError } from '../api/http.ts';
import type { NotificationItem, NotificationPage } from '../types/index.ts';

const POLL_MS = 10000;

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<NotificationItem[]>([]);
  const hasMore = ref(false);
  const unreadCount = ref(0);
  const isLoading = ref(false);
  const isOpen = ref(false);
  const error = ref<string | null>(null);

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;
  let live = false;

  function mergeFirstPage(incoming: NotificationItem[]): boolean {
    const hadLoadedMore = items.value.some(
      (item) => !incoming.some((row) => row.id === item.id),
    );

    if (!hadLoadedMore) {
      items.value = incoming;
      return false;
    }

    const headIds = new Set(incoming.map((row) => row.id));
    const tail = items.value.filter((item) => !headIds.has(item.id));
    items.value = [...incoming, ...tail];
    return true;
  }

  async function fetchList(
    reset = true,
    options?: { silent?: boolean },
  ): Promise<void> {
    const silent = options?.silent ?? false;

    if (inFlight && silent) {
      return;
    }

    inFlight = true;

    if (!silent) {
      isLoading.value = true;
    }

    error.value = null;

    try {
      const last = items.value[items.value.length - 1];
      const { data } = await http.get<NotificationPage>('/notifications', {
        params: !reset && last ? { before: last.createdAt } : undefined,
      });

      if (!live) {
        return;
      }

      if (reset) {
        const merged = mergeFirstPage(data.items);

        if (!merged) {
          hasMore.value = data.hasMore;
        }
      } else {
        items.value = [...items.value, ...data.items];
        hasMore.value = data.hasMore;
      }

      unreadCount.value = data.unreadCount;
    } catch (err: unknown) {
      error.value = errorMessage(err);

      if (reset && !items.value.length) {
        hasMore.value = false;
      }
    } finally {
      inFlight = false;
      isLoading.value = false;
    }
  }

  async function loadMore(): Promise<void> {
    if (!hasMore.value || isLoading.value) {
      return;
    }

    await fetchList(false);
  }

  async function markRead(id: string): Promise<void> {
    const item = items.value.find((row) => row.id === id);

    if (!item || item.readAt) {
      return;
    }

    try {
      await http.patch(`/notifications/${id}/read`);
      item.readAt = new Date().toISOString();

      if (unreadCount.value > 0) {
        unreadCount.value -= 1;
      }
    } catch (err: unknown) {
      toastError('Не удалось отметить уведомление', err);
    }
  }

  async function markAllRead(): Promise<void> {
    if (unreadCount.value === 0) {
      return;
    }

    try {
      await http.post('/notifications/read-all');
      const now = new Date().toISOString();

      items.value = items.value.map((item) => (
        item.readAt ? item : { ...item, readAt: now }
      ));
      unreadCount.value = 0;
    } catch (err: unknown) {
      toastError('Не удалось отметить уведомления', err);
    }
  }

  function openDrawer(): void {
    isOpen.value = true;

    if (!items.value.length) {
      void fetchList(true);
    }
  }

  function closeDrawer(): void {
    isOpen.value = false;
  }

  function toggleDrawer(): void {
    if (isOpen.value) {
      closeDrawer();
      return;
    }

    openDrawer();
  }

  function startPolling(): void {
    stopPolling();
    live = true;
    void fetchList(true);

    pollTimer = setInterval(() => {
      if (document.hidden) {
        return;
      }

      void fetchList(true, { silent: true });
    }, POLL_MS);
  }

  function stopPolling(): void {
    live = false;

    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }

    items.value = [];
    hasMore.value = false;
    unreadCount.value = 0;
    isOpen.value = false;
    error.value = null;
  }

  return {
    items,
    hasMore,
    unreadCount,
    isLoading,
    isOpen,
    error,
    fetchList,
    loadMore,
    markRead,
    markAllRead,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    startPolling,
    stopPolling,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(
    acceptHMRUpdate(useNotificationsStore, import.meta.hot),
  );
}
