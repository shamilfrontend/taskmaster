import { acceptHMRUpdate, defineStore } from 'pinia';
import { ref } from 'vue';
import {
  http, errorMessage, toastError, toastSuccess,
} from '../api/http.ts';
import type {
  ActivityItem,
  InviteRole,
  TeamActivityPage,
  TeamDetails,
  TeamListItem,
  TeamRole,
} from '../types/index.ts';

export const useTeamsStore = defineStore('teams', () => {
  const list = ref<TeamListItem[]>([]);
  const current = ref<TeamDetails | null>(null);
  const activity = ref<ActivityItem[]>([]);
  const activityHasMore = ref(false);
  const isLoading = ref(false);
  const isActivityLoading = ref(false);
  const error = ref<string | null>(null);

  async function fetchList(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await http.get<TeamListItem[]>('/teams');
      list.value = data;
    } catch (err: unknown) {
      error.value = errorMessage(err);
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchOne(teamId: string): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await http.get<TeamDetails>(`/teams/${teamId}`);
      current.value = data;
    } catch (err: unknown) {
      error.value = errorMessage(err);

      if (current.value?.id === teamId) {
        current.value = null;
      }
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchActivity(
    teamId: string,
    reset = true,
  ): Promise<void> {
    isActivityLoading.value = true;
    error.value = null;

    try {
      const last = activity.value[activity.value.length - 1];
      const { data } = await http.get<TeamActivityPage>(
        `/teams/${teamId}/activity`,
        {
          params: !reset && last ? { before: last.createdAt } : undefined,
        },
      );

      if (reset) {
        activity.value = data.items;
      } else {
        activity.value = [...activity.value, ...data.items];
      }

      activityHasMore.value = data.hasMore;
    } catch (err: unknown) {
      error.value = errorMessage(err);

      if (reset) {
        activity.value = [];
        activityHasMore.value = false;
      }
    } finally {
      isActivityLoading.value = false;
    }
  }

  async function createTeam(name: string): Promise<string | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await http.post<{ id: string }>('/teams', { name });
      await fetchList();
      toastSuccess('Команда создана');
      return data.id;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      toastError('Ошибка при создании команды', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function createInvite(teamId: string, role: InviteRole): Promise<string | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await http.post<{ token: string }>(
        `/teams/${teamId}/invites`,
        { role },
      );
      await fetchOne(teamId);
      toastSuccess('Приглашение создано');
      return data.token;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      toastError('Ошибка при создании приглашения', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function renameTeam(teamId: string, name: string): Promise<boolean> {
    error.value = null;

    try {
      const { data } = await http.patch<{ id: string; name: string }>(
        `/teams/${teamId}`,
        { name },
      );

      if (current.value?.id === teamId) {
        current.value = { ...current.value, name: data.name };
      }

      const item = list.value.find((team) => team.id === teamId);

      if (item) {
        item.name = data.name;
      }

      toastSuccess('Команда обновлена');
      return true;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      toastError('Ошибка при обновлении команды', err);
      return false;
    }
  }

  async function revokeInvite(
    teamId: string,
    inviteId: string,
  ): Promise<boolean> {
    error.value = null;

    try {
      await http.delete(`/teams/${teamId}/invites/${inviteId}`);
      await fetchOne(teamId);
      toastSuccess('Приглашение отозвано');
      return true;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      toastError('Ошибка при отзыве приглашения', err);
      return false;
    }
  }

  async function deleteTeam(teamId: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      await http.delete(`/teams/${teamId}`);
      list.value = list.value.filter((team) => team.id !== teamId);

      if (current.value?.id === teamId) {
        current.value = null;
      }

      toastSuccess('Команда удалена');
      return true;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      toastError('Ошибка при удалении команды', err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function changeRole(
    teamId: string,
    userId: string,
    role: TeamRole,
  ): Promise<boolean> {
    error.value = null;

    try {
      await http.patch(`/teams/${teamId}/members/${userId}`, { role });
      await fetchOne(teamId);
      toastSuccess('Роль обновлена');
      return true;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      toastError('Ошибка при изменении роли', err);
      return false;
    }
  }

  async function removeMember(
    teamId: string,
    userId: string,
    refresh = true,
  ): Promise<boolean> {
    error.value = null;

    try {
      await http.delete(`/teams/${teamId}/members/${userId}`);

      if (refresh) {
        await fetchOne(teamId);
      } else {
        list.value = list.value.filter((team) => team.id !== teamId);

        if (current.value?.id === teamId) {
          current.value = null;
        }
      }

      toastSuccess('Участник исключён');
      return true;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      toastError('Ошибка при исключении участника', err);
      return false;
    }
  }

  async function createProject(
    teamId: string,
    name: string,
  ): Promise<string | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await http.post<{ id: string }>(
        `/teams/${teamId}/projects`,
        { name },
      );
      await fetchOne(teamId);
      toastSuccess('Проект создан');
      return data.id;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      toastError('Ошибка при создании проекта', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function createProjectFromTrello(
    teamId: string,
    name: string,
    board: unknown,
  ): Promise<string | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await http.post<{ id: string }>(
        `/teams/${teamId}/projects/from-trello`,
        { name, board },
        { timeout: 60000 },
      );
      await fetchOne(teamId);
      toastSuccess('Проект импортирован');
      return data.id;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      toastError('Ошибка при импорте проекта', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    list,
    current,
    activity,
    activityHasMore,
    isLoading,
    isActivityLoading,
    error,
    fetchList,
    fetchOne,
    fetchActivity,
    createTeam,
    renameTeam,
    createInvite,
    revokeInvite,
    deleteTeam,
    changeRole,
    removeMember,
    createProject,
    createProjectFromTrello,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTeamsStore, import.meta.hot));
}
