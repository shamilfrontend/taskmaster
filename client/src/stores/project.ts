import { defineStore } from 'pinia';
import { ref } from 'vue';
import { http, errorMessage } from '../api/http.ts';
import type {
  AnalyticsPayload,
  AnalyticsPeriod,
  ProjectDetails,
  TeamRole
} from '../types/index.ts';

export const useProjectStore = defineStore('project', () => {
  const current = ref<ProjectDetails | null>(null);
  const analytics = ref<AnalyticsPayload | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function fetchOne(projectId: string): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await http.get<ProjectDetails>(`/projects/${projectId}`);
      current.value = data;
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

  async function createBoard(projectId: string, name: string): Promise<string | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await http.post<{ id: string }>(
        `/projects/${projectId}/boards`,
        { name }
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
    createBoard,
    createRelease,
    saveRoleRates,
    saveMemberRate,
    fetchAnalytics
  };
});
