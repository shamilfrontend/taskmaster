import { acceptHMRUpdate, defineStore } from 'pinia';
import { ref } from 'vue';
import { errorMessage, http } from '../api/http.ts';
import type { MyTasksPayload } from '../types/index.ts';

interface FetchOptions {
  done?: boolean;
  teamId?: string;
  projectId?: string;
}

export const useMyTasksStore = defineStore('my-tasks', () => {
  const data = ref<MyTasksPayload | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  let fetchSeq = 0;

  async function fetchTasks(options: FetchOptions = {}): Promise<void> {
    fetchSeq += 1;
    const seq = fetchSeq;
    isLoading.value = true;
    error.value = null;

    try {
      const { data: payload } = await http.get<MyTasksPayload>('/me/tasks', {
        params: {
          ...(options.done ? { done: '1' } : {}),
          ...(options.teamId ? { teamId: options.teamId } : {}),
          ...(options.projectId ? { projectId: options.projectId } : {}),
        },
      });

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

  return {
    data,
    isLoading,
    error,
    fetchTasks,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useMyTasksStore, import.meta.hot));
}
