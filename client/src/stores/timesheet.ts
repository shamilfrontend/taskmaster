import { acceptHMRUpdate, defineStore } from 'pinia';
import { ref } from 'vue';
import {
  http, errorMessage, toastError, toastSuccess,
} from '../api/http.ts';
import type { TimesheetPayload } from '../types/index.ts';
import { useBoardStore } from './board.ts';
import { useProjectStore } from './project.ts';

interface FetchOptions {
  from: string;
  to: string;
  userId?: string;
}

export const useTimesheetStore = defineStore('timesheet', () => {
  const data = ref<TimesheetPayload | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  let fetchSeq = 0;

  async function refreshBoardIfNeeded(): Promise<void> {
    const board = useBoardStore();
    const project = useProjectStore();
    const boardId = project.current?.board.id;

    if (boardId && board.current?.id === boardId) {
      await board.fetchBoard(boardId);

      if (board.card) {
        await board.fetchCard(board.card.id);
      }
    }
  }

  async function fetchTimesheet(
    projectId: string,
    options: FetchOptions,
  ): Promise<void> {
    fetchSeq += 1;
    const seq = fetchSeq;
    isLoading.value = true;
    error.value = null;

    try {
      const { data: payload } = await http.get<TimesheetPayload>(
        `/projects/${projectId}/time-entries`,
        {
          params: {
            from: options.from,
            to: options.to,
            ...(options.userId ? { userId: options.userId } : {}),
          },
        },
      );

      if (seq !== fetchSeq) {
        return;
      }

      data.value = payload;
    } catch (err: unknown) {
      if (seq !== fetchSeq) {
        return;
      }

      error.value = errorMessage(err);
    } finally {
      if (seq === fetchSeq) {
        isLoading.value = false;
      }
    }
  }

  async function logHours(
    cardId: string,
    hours: number,
    workedAt?: string,
  ): Promise<void> {
    try {
      await http.post(`/cards/${cardId}/time-entries`, {
        hours,
        ...(workedAt ? { workedAt } : {}),
      });
      toastSuccess('Часы списаны');
      await refreshBoardIfNeeded();
    } catch (err: unknown) {
      toastError('Ошибка при списании часов', err);
      throw err;
    }
  }

  async function patchTimeEntry(entryId: string, hours: number): Promise<void> {
    try {
      await http.patch(`/cards/time-entries/${entryId}`, { hours });
      toastSuccess('Списание обновлено');
      await refreshBoardIfNeeded();
    } catch (err: unknown) {
      toastError('Ошибка при обновлении списания', err);
      throw err;
    }
  }

  async function deleteTimeEntry(entryId: string): Promise<void> {
    try {
      await http.delete(`/cards/time-entries/${entryId}`);
      toastSuccess('Списание удалено');
      await refreshBoardIfNeeded();
    } catch (err: unknown) {
      toastError('Ошибка при удалении списания', err);
      throw err;
    }
  }

  function reset(): void {
    fetchSeq += 1;
    data.value = null;
    error.value = null;
    isLoading.value = false;
  }

  return {
    data,
    isLoading,
    error,
    fetchTimesheet,
    logHours,
    patchTimeEntry,
    deleteTimeEntry,
    reset,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTimesheetStore, import.meta.hot));
}
