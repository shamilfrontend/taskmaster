import { acceptHMRUpdate, defineStore } from 'pinia';
import { ref } from 'vue';
import {
  http, errorMessage, toastError, toastSuccess,
} from '../api/http.ts';
import { downloadJson, fileSlug } from '../composables/download.ts';
import type {
  AnalyticsPayload,
  AnalyticsPeriod,
  BoardBackgroundId,
  InviteRole,
  ProjectDetails,
  ProjectMembersPayload,
} from '../types/index.ts';
import { useTeamsStore } from './teams.ts';

interface ProjectPayload extends Omit<ProjectDetails, 'board'> {
  board?: { id: string };
}

function toProjectDetails(data: ProjectPayload): ProjectDetails {
  const boardId = data.board?.id ?? '';

  return {
    ...data,
    boardBackground: data.boardBackground ?? 'default',
    teamRole: data.teamRole ?? data.role,
    people: data.people ?? [],
    board: { id: boardId },
  };
}

export const useProjectStore = defineStore('project', () => {
  const current = ref<ProjectDetails | null>(null);
  const members = ref<ProjectMembersPayload | null>(null);
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

  async function renameProject(
    projectId: string,
    name: string,
  ): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await http.patch<{ id: string; name: string }>(
        `/projects/${projectId}`,
        { name },
      );

      if (current.value?.id === projectId) {
        current.value = { ...current.value, name: data.name };
      }

      const teams = useTeamsStore();
      const item = teams.current?.projects.find(
        (project) => project.id === projectId,
      );

      if (item) {
        item.name = data.name;
      }

      toastSuccess('Проект переименован');
      return true;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      toastError('Ошибка при переименовании проекта', err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function updateSettings(
    projectId: string,
    payload: {
      releasesEnabled?: boolean;
      analyticsEnabled?: boolean;
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

  async function exportProject(projectId: string, name?: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await http.get<unknown>(`/projects/${projectId}/export`);
      const label = name
        ?? (current.value?.id === projectId ? current.value.name : undefined);
      downloadJson(`${fileSlug(label ?? 'project')}.taskmaster.json`, data);
      toastSuccess('Проект экспортирован');
      return true;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      toastError('Ошибка при экспорте проекта', err);
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

  async function fetchMembers(projectId: string): Promise<void> {
    try {
      const { data } = await http.get<ProjectMembersPayload>(
        `/projects/${projectId}/members`,
      );
      members.value = data;
    } catch (err: unknown) {
      toastError('Ошибка при загрузке участников', err);
    }
  }

  async function addMember(
    projectId: string,
    userId: string,
    role: InviteRole,
  ): Promise<boolean> {
    try {
      await http.post(`/projects/${projectId}/members`, { userId, role });
      await Promise.all([fetchOne(projectId), fetchMembers(projectId)]);
      toastSuccess('Участник добавлен');
      return true;
    } catch (err: unknown) {
      toastError('Ошибка при добавлении участника', err);
      return false;
    }
  }

  async function changeMemberRole(
    projectId: string,
    userId: string,
    role: InviteRole,
  ): Promise<boolean> {
    try {
      await http.patch(`/projects/${projectId}/members/${userId}`, { role });
      await Promise.all([fetchOne(projectId), fetchMembers(projectId)]);
      toastSuccess('Роль обновлена');
      return true;
    } catch (err: unknown) {
      toastError('Ошибка при изменении роли', err);
      return false;
    }
  }

  async function removeMember(
    projectId: string,
    userId: string,
  ): Promise<boolean> {
    try {
      await http.delete(`/projects/${projectId}/members/${userId}`);
      await Promise.all([fetchOne(projectId), fetchMembers(projectId)]);
      toastSuccess('Участник исключён');
      return true;
    } catch (err: unknown) {
      toastError('Ошибка при исключении участника', err);
      return false;
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
    members,
    analytics,
    isLoading,
    error,
    fetchOne,
    fetchMembers,
    addMember,
    changeMemberRole,
    removeMember,
    renameProject,
    updateSettings,
    createRelease,
    deleteProject,
    exportProject,
    duplicateProject,
    fetchAnalytics,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useProjectStore, import.meta.hot));
}
