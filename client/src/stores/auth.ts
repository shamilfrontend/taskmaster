import { defineStore } from 'pinia';
import { ref } from 'vue';
import { http, errorMessage } from '../api/http.ts';
import type { AuthUser } from '../types/index.ts';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function fetchMe(): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await http.get<AuthUser>('/auth/me');
      user.value = data;
      return true;
    } catch (err: unknown) {
      user.value = null;
      error.value = errorMessage(err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  function login(next = '/'): void {
    window.location.assign(`/api/auth/yandex?next=${encodeURIComponent(next)}`);
  }

  async function logout(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      await http.post('/auth/logout');
      user.value = null;
    } catch (err: unknown) {
      error.value = errorMessage(err);
    } finally {
      isLoading.value = false;
    }
  }

  return { user, isLoading, error, fetchMe, login, logout };
});
