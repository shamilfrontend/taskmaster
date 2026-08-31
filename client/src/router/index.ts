import {
  createRouter,
  createWebHistory,
  type LocationQuery,
  type RouteLocationNormalized,
} from 'vue-router';
import { http } from '../api/http.ts';
import { safeAuthNext, useAuthStore } from '../stores/auth.ts';

declare global {
  interface Window {
    ym?: (counterId: number, method: string, ...args: unknown[]) => void;
  }
}

const YANDEX_METRIKA_ID = 111630298;

const emptyRouteComponent = {
  setup() {
    return () => null;
  },
};

function queryWithoutTab(query: LocationQuery): LocationQuery {
  const next = { ...query };
  delete next.tab;
  return next;
}

function redirectLegacyProjectTab(to: RouteLocationNormalized) {
  const { tab } = to.query;

  if (tab === 'releases') {
    return {
      name: 'project-releases',
      params: { projectId: to.params.projectId },
      query: queryWithoutTab(to.query),
    };
  }

  if (tab === 'members') {
    return {
      name: 'project-members',
      params: { projectId: to.params.projectId },
      query: queryWithoutTab(to.query),
    };
  }

  if (tab === 'settings') {
    return {
      name: 'project-settings',
      params: { projectId: to.params.projectId },
      query: queryWithoutTab(to.query),
    };
  }

  if (tab !== undefined) {
    return {
      name: 'project',
      params: { projectId: to.params.projectId },
      query: queryWithoutTab(to.query),
    };
  }

  return true;
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      redirect: (to) => {
        const { next } = to.query;

        if (typeof next === 'string') {
          return { path: '/landing', query: { next } };
        }

        return { path: '/landing' };
      },
    },
    {
      path: '/landing',
      name: 'landing',
      component: () => import('../views/LoginView.vue'),
      meta: { chrome: false, public: true },
    },
    {
      path: '/invite/:token',
      name: 'invite',
      component: () => import('../views/InviteView.vue'),
      meta: { chrome: false, public: true },
    },
    {
      path: '/',
      name: 'teams',
      component: () => import('../views/TeamsView.vue'),
      meta: { chrome: true },
    },
    {
      path: '/my-tasks',
      name: 'my-tasks',
      component: () => import('../views/MyTasksView.vue'),
      meta: { chrome: true },
    },
    {
      path: '/notifications',
      name: 'notifications',
      component: () => import('../views/NotificationsView.vue'),
      meta: { chrome: true },
    },
    {
      path: '/more',
      name: 'more',
      component: () => import('../views/MoreView.vue'),
      meta: { chrome: true },
    },
    {
      path: '/teams/:teamId',
      name: 'team',
      component: () => import('../views/TeamView.vue'),
      meta: { chrome: true },
    },
    {
      path: '/projects/:projectId',
      component: () => import('../views/ProjectLayout.vue'),
      meta: { chrome: true },
      children: [
        {
          path: '',
          name: 'project',
          component: () => import('../views/ProjectView.vue'),
          beforeEnter: redirectLegacyProjectTab,
        },
        {
          path: 'releases',
          name: 'project-releases',
          component: () => import('../views/ProjectReleasesView.vue'),
        },
        {
          path: 'releases/:releaseId',
          name: 'release',
          component: () => import('../views/ReleaseView.vue'),
        },
        {
          path: 'analytics',
          name: 'analytics',
          component: () => import('../views/AnalyticsView.vue'),
        },
        {
          path: 'members',
          name: 'project-members',
          component: () => import('../views/ProjectMembersView.vue'),
        },
        {
          path: 'settings',
          name: 'project-settings',
          component: () => import('../views/ProjectSettingsView.vue'),
        },
      ],
    },
    {
      path: '/boards/:boardId',
      name: 'board',
      component: emptyRouteComponent,
      meta: { chrome: true },
      beforeEnter: async (to) => {
        try {
          const { data } = await http.get<{ projectId: string }>(
            `/boards/${String(to.params.boardId)}`,
          );

          return {
            name: 'project',
            params: { projectId: data.projectId },
            query: to.query,
          };
        } catch {
          return { name: 'teams' };
        }
      },
    },
    {
      path: '/releases/:releaseId',
      name: 'legacy-release',
      component: emptyRouteComponent,
      meta: { chrome: true },
      beforeEnter: async (to) => {
        try {
          const { data } = await http.get<{ projectId: string }>(
            `/releases/${String(to.params.releaseId)}`,
          );

          return {
            name: 'release',
            params: {
              projectId: data.projectId,
              releaseId: to.params.releaseId,
            },
            query: to.query,
          };
        } catch {
          return { name: 'teams' };
        }
      },
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (!auth.user && !auth.isLoading) {
    await auth.fetchMe();
  }

  if (to.meta.public) {
    if (to.name === 'landing' && auth.user) {
      return safeAuthNext(to.query.next);
    }

    return true;
  }

  if (!auth.user) {
    if (to.name === 'teams') {
      return { name: 'landing' };
    }

    const next = safeAuthNext(to.fullPath);

    if (next === '/') {
      return { name: 'landing' };
    }

    return {
      name: 'landing',
      query: { next },
    };
  }

  return true;
});

router.afterEach((to) => {
  const { ym } = window;
  if (typeof ym === 'function') {
    ym(YANDEX_METRIKA_ID, 'hit', to.fullPath);
  }
});
