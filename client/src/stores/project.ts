import { acceptHMRUpdate, defineStore } from 'pinia';
import { ref } from 'vue';
import {
  http, errorMessage, toastError, toastSuccess,
} from '../api/http.ts';
import type {
  AnalyticsPayload,
  AnalyticsPeriod,
  BoardBackgroundId,
  ProjectDetails,
  TeamRole,
} from '../types/index.ts';

interface ProjectPayload extends Omit<ProjectDetails, 'board'> {
  board?: { id: string };
  boards?: { id: string }[];
}

function toProjectDetails(data: ProjectPayload): ProjectDetails {
  const boardId = data.board?.id ?? data.boards?.[0]?.id ?? '';

  return {
    ...data,
    boardBackground: data.boardBackground ?? 'default',
    board: { id: boardId },
  };
}

export const useProjectStore = defineStore('project', () => {
  const current = ref<ProjectDetails | null>(null);
  const analytics = ref<AnalyticsPayload | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function fetchOne(projectId: string): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await http.get<ProjectPayload>(`/projects/${projectId}`);
      current.value = toProjectDetails(data);
    } catch (err: unknown) {
      error.value = errorMessage(err);
    } finally {
      isLoading.value = false;
    }
  }

  async function updateBudget(projectId: string, budgetLimit: number): Promise<void> {
    try {
      await http.patch(`/projects/${projectId}`, { budgetLimit });
      await fetchOne(projectId);
      toastSuccess('Бюджет обновлён');
    } catch (err: unknown) {
      toastError('Ошибка при обновлении бюджета', err);
      throw err;
    }
  }

  async function updateSettings(
    projectId: string,
    payload: {
      releasesEnabled?: boolean;
      budgetEnabled?: boolean;
      boardBackground?: BoardBackgroundId;
    },
  ): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      await http.patch(`/projects/${projectId}`, payload);
      await fetchOne(projectId);

      if (current.value && payload.boardBackground) {
        current.value.boardBackground = payload.boardBackground;
      }

      toastSuccess('Настройки проекта обновлены');
    } catch (err: unknown) {
      error.value = errorMessage(err);
      toastError('Ошибка при обновлении настроек', err);
    } finally {
      isLoading.value = false;
    }
  }

  async function createRelease(
    projectId: string,
    name: string,
    date?: string,
  ): Promise<string | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await http.post<{ id: string }>(
        `/projects/${projectId}/releases`,
        { name, date },
      );
      await fetchOne(projectId);
      toastSuccess('Релиз создан');
      return data.id;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      toastError('Ошибка при создании релиза', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function saveRoleRates(
    projectId: string,
    roleRates: Record<TeamRole, number>,
  ): Promise<void> {
    try {
      await http.put(`/projects/${projectId}/role-rates`, roleRates);
      await fetchOne(projectId);
      toastSuccess('Ставки сохранены');
    } catch (err: unknown) {
      toastError('Ошибка при сохранении ставок', err);
      throw err;
    }
  }

  async function deleteProject(projectId: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      await http.delete(`/projects/${projectId}`);
      current.value = null;
      toastSuccess('Проект удалён');
      return true;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      toastError('Ошибка при удалении проекта', err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function duplicateProject(projectId: string): Promise<string | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await http.post<{ id: string }>(
        `/projects/${projectId}/duplicate`,
      );
      toastSuccess('Проект скопирован');
      return data.id;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      toastError('Ошибка при копировании проекта', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchAnalytics(
    projectId: string,
    period: AnalyticsPeriod,
    range?: { from: string; to: string },
  ): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const params = period === 'custom' && range
        ? { from: range.from, to: range.to }
        : { period };
      const { data } = await http.get<AnalyticsPayload>(
        `/projects/${projectId}/analytics`,
        { params },
      );
      analytics.value = data;
    } catch (err: unknown) {
      error.value = errorMessage(err);
    } finally {
      isLoading.value = false;
    }
  }

  return {
    current,
    analytics,
    isLoading,
    error,
    fetchOne,
    updateBudget,
    updateSettings,
    createRelease,
    saveRoleRates,
    deleteProject,
    duplicateProject,
    fetchAnalytics,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useProjectStore, import.meta.hot));
}
