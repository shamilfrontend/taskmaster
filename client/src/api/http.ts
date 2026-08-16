import axios, { isAxiosError } from 'axios';
import { notify } from '@kyvg/vue3-notification';
import type { ApiErrorBody } from '../types/index.ts';

export const DEMO_BLOCKED_MESSAGE = 'Действия в демо-доступе отключены';

export class DemoBlockedError extends Error {
  readonly isDemoBlocked = true;

  constructor() {
    super(DEMO_BLOCKED_MESSAGE);
    this.name = 'DemoBlockedError';
  }
}

export const http = axios.create({
  baseURL: '/api',
  withCredentials: true
});

let demoMode = false;

export function setDemoMode(value: boolean): void {
  demoMode = value;
}

function isWriteAllowed(url: string): boolean {
  return url.includes('/auth/logout') || url.includes('/auth/demo');
}

function isMutating(method: string | undefined): boolean {
  const verb = (method ?? 'get').toLowerCase();

  return verb !== 'get' && verb !== 'head' && verb !== 'options';
}

http.interceptors.request.use((config) => {
  if (!demoMode || !isMutating(config.method) || isWriteAllowed(config.url ?? '')) {
    return config;
  }

  notify({
    type: 'warn',
    text: DEMO_BLOCKED_MESSAGE,
    ignoreDuplicates: true
  });

  throw new DemoBlockedError();
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
  if (err instanceof DemoBlockedError) {
    return err.message;
  }

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
