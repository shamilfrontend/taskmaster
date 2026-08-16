import { acceptHMRUpdate, defineStore } from 'pinia';
import { ref } from 'vue';
import { http, errorMessage } from '../api/http.ts';
import type {
  ActivityItem,
  InviteRole,
  TeamActivityPage,
  TeamDetails,
  TeamListItem,
  TeamRole
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
    reset = true
  ): Promise<void> {
    isActivityLoading.value = true;
    error.value = null;

    try {
      const last = activity.value[activity.value.length - 1];
      const { data } = await http.get<TeamActivityPage>(
        `/teams/${teamId}/activity`,
        {
          params: !reset && last ? { before: last.createdAt } : undefined
        }
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
      return data.id;
    } catch (err: unknown) {
      error.value = errorMessage(err);
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
        { role }
      );
      await fetchOne(teamId);
      return data.token;
    } catch (err: unknown) {
      error.value = errorMessage(err);
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
        { name }
      );

      if (current.value?.id === teamId) {
        current.value = { ...current.value, name: data.name };
      }

      const item = list.value.find((team) => team.id === teamId);

      if (item) {
        item.name = data.name;
      }

      return true;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      return false;
    }
  }

  async function revokeInvite(
    teamId: string,
    inviteId: string
  ): Promise<boolean> {
    error.value = null;

    try {
      await http.delete(`/teams/${teamId}/invites/${inviteId}`);
      await fetchOne(teamId);
      return true;
    } catch (err: unknown) {
      error.value = errorMessage(err);
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

      return true;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function changeRole(
    teamId: string,
    userId: string,
    role: TeamRole
  ): Promise<boolean> {
    error.value = null;

    try {
      await http.patch(`/teams/${teamId}/members/${userId}`, { role });
      await fetchOne(teamId);
      return true;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      return false;
    }
  }

  async function removeMember(
    teamId: string,
    userId: string,
    refresh = true
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

      return true;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      return false;
    }
  }

  async function createProject(
    teamId: string,
    name: string,
    budgetLimit?: number
  ): Promise<string | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await http.post<{ id: string }>(
        `/teams/${teamId}/projects`,
        { name, budgetLimit }
      );
      await fetchOne(teamId);
      return data.id;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function duplicateProject(projectId: string): Promise<string | null> {
    error.value = null;

    try {
      const { data } = await http.post<{ id: string }>(
        `/projects/${projectId}/duplicate`
      );

      if (current.value) {
        await fetchOne(current.value.id);
      }

      return data.id;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      return null;
    }
  }

  async function deleteProject(projectId: string): Promise<boolean> {
    error.value = null;

    try {
      await http.delete(`/projects/${projectId}`);

      if (current.value) {
        await fetchOne(current.value.id);
      }

      return true;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      return false;
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
    duplicateProject,
    deleteProject
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTeamsStore, import.meta.hot));
}
