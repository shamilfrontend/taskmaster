import axios, { isAxiosError } from 'axios';
import type { ApiErrorBody } from '../types/index.ts';

export const http = axios.create({
  baseURL: '/api',
  withCredentials: true
});

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url ?? '';
      const isMe = url.includes('/auth/me');
      const path = window.location.pathname;
      const isPublic =
        path.startsWith('/landing') ||
        path.startsWith('/login') ||
        path.startsWith('/invite');

      if (!isMe && !isPublic) {
        const next = encodeURIComponent(path + window.location.search);
        window.location.assign(`/landing?next=${next}`);
      }
    }

    return Promise.reject(error);
  }
);

export function errorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const data: unknown = err.response?.data;

    if (typeof data === 'object' && data !== null && 'error' in data) {
      const body = data as ApiErrorBody;

      if (typeof body.error === 'string') {
        return body.error;
      }
    }

    return err.message;
  }

  if (err instanceof Error) {
    return err.message;
  }

  return 'Неизвестная ошибка';
}
