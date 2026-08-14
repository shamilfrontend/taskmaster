import { defineStore } from 'pinia';
import { ref } from 'vue';
import { http, errorMessage } from '../api/http.ts';
import type {
  InviteRole,
  TeamDetails,
  TeamListItem,
  TeamRole
} from '../types/index.ts';

export const useTeamsStore = defineStore('teams', () => {
  const list = ref<TeamListItem[]>([]);
  const current = ref<TeamDetails | null>(null);
  const isLoading = ref(false);
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
    } finally {
      isLoading.value = false;
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

  async function revokeInvite(teamId: string, inviteId: string): Promise<void> {
    await http.delete(`/teams/${teamId}/invites/${inviteId}`);
    await fetchOne(teamId);
  }

  async function transferOwner(teamId: string, userId: string): Promise<void> {
    await http.post(`/teams/${teamId}/transfer`, { userId });
    await fetchOne(teamId);
  }

  async function deleteTeam(teamId: string, confirmName: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      await http.delete(`/teams/${teamId}`, { data: { confirmName } });
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
  ): Promise<void> {
    await http.patch(`/teams/${teamId}/members/${userId}`, { role });
    await fetchOne(teamId);
  }

  async function removeMember(teamId: string, userId: string): Promise<void> {
    await http.delete(`/teams/${teamId}/members/${userId}`);
    await fetchOne(teamId);
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

  return {
    list,
    current,
    isLoading,
    error,
    fetchList,
    fetchOne,
    createTeam,
    createInvite,
    revokeInvite,
    transferOwner,
    deleteTeam,
    changeRole,
    removeMember,
    createProject
  };
});
