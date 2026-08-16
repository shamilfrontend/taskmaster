import { createRouter, createWebHistory } from 'vue-router';
import { http } from '../api/http.ts';
import { useAuthStore } from '../stores/auth.ts';

declare global {
  interface Window {
    ym?: (counterId: number, method: string, ...args: unknown[]) => void;
  }
}

const YANDEX_METRIKA_ID = 111630298;

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      redirect: (to) => {
        const next = to.query.next;

        if (typeof next === 'string') {
          return { path: '/landing', query: { next } };
        }

        return { path: '/landing' };
      }
    },
    {
      path: '/landing',
      name: 'landing',
      component: () => import('../views/LoginView.vue'),
      meta: { chrome: false, public: true }
    },
    {
      path: '/invite/:token',
      name: 'invite',
      component: () => import('../views/InviteView.vue'),
      meta: { chrome: false, public: true }
    },
    {
      path: '/',
      name: 'teams',
      component: () => import('../views/TeamsView.vue'),
      meta: { chrome: true }
    },
    {
      path: '/teams/:teamId',
      name: 'team',
      component: () => import('../views/TeamView.vue'),
      meta: { chrome: true }
    },
    {
      path: '/projects/:projectId',
      name: 'project',
      component: () => import('../views/ProjectView.vue'),
      meta: { chrome: true }
    },
    {
      path: '/projects/:projectId/analytics',
      name: 'analytics',
      component: () => import('../views/AnalyticsView.vue'),
      meta: { chrome: true }
    },
    {
      path: '/boards/:boardId',
      name: 'board',
      component: () => import('../views/BoardView.vue'),
      meta: { chrome: true },
      beforeEnter: async (to) => {
        try {
          const { data } = await http.get<{ projectId: string }>(
            `/boards/${String(to.params.boardId)}`
          );

          return {
            name: 'project',
            params: { projectId: data.projectId },
            query: to.query
          };
        } catch {
          return { name: 'teams' };
        }
      }
    },
    {
      path: '/releases/:releaseId',
      name: 'release',
      component: () => import('../views/ReleaseView.vue'),
      meta: { chrome: true }
    }
  ]
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (!auth.user && !auth.isLoading) {
    await auth.fetchMe();
  }

  if (to.meta.public) {
    if (to.name === 'landing' && auth.user) {
      const next =
        typeof to.query.next === 'string' ? to.query.next : '/';
      return next;
    }

    return true;
  }

  if (!auth.user) {
    if (to.name === 'teams') {
      return { name: 'landing' };
    }

    return {
      name: 'landing',
      query: { next: to.fullPath }
    };
  }

  return true;
});

router.afterEach((to) => {
  const ym = window.ym;
  if (typeof ym === 'function') {
    ym(YANDEX_METRIKA_ID, 'hit', to.fullPath);
  }
});
