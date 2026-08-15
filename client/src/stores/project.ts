import { acceptHMRUpdate, defineStore } from 'pinia';
import { ref } from 'vue';
import { http, errorMessage } from '../api/http.ts';
import type {
  AnalyticsPayload,
  AnalyticsPeriod,
  BoardBackgroundId,
  ProjectDetails,
  TeamRole
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
    board: { id: boardId }
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
    await http.patch(`/projects/${projectId}`, { budgetLimit });
    await fetchOne(projectId);
  }

  async function updateSettings(
    projectId: string,
    payload: {
      releasesEnabled?: boolean;
      budgetEnabled?: boolean;
      boardBackground?: BoardBackgroundId;
    }
  ): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      await http.patch(`/projects/${projectId}`, payload);
      await fetchOne(projectId);

      if (current.value && payload.boardBackground) {
        current.value.boardBackground = payload.boardBackground;
      }
    } catch (err: unknown) {
      error.value = errorMessage(err);
    } finally {
      isLoading.value = false;
    }
  }

  async function createRelease(
    projectId: string,
    name: string,
    date?: string
  ): Promise<string | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await http.post<{ id: string }>(
        `/projects/${projectId}/releases`,
        { name, date }
      );
      await fetchOne(projectId);
      return data.id;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function saveRoleRates(
    projectId: string,
    roleRates: Record<TeamRole, number>
  ): Promise<void> {
    await http.put(`/projects/${projectId}/role-rates`, roleRates);
    await fetchOne(projectId);
  }

  async function saveMemberRate(
    projectId: string,
    userId: string,
    amount: number | null
  ): Promise<void> {
    await http.put(`/projects/${projectId}/member-rates`, { userId, amount });
    await fetchOne(projectId);
  }

  async function deleteProject(projectId: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      await http.delete(`/projects/${projectId}`);
      current.value = null;
      return true;
    } catch (err: unknown) {
      error.value = errorMessage(err);
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
        `/projects/${projectId}/duplicate`
      );
      return data.id;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchAnalytics(
    projectId: string,
    period: AnalyticsPeriod
  ): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await http.get<AnalyticsPayload>(
        `/projects/${projectId}/analytics`,
        { params: { period } }
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
    saveMemberRate,
    deleteProject,
    duplicateProject,
    fetchAnalytics
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useProjectStore, import.meta.hot));
}
