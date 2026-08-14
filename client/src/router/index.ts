import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
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
      meta: { chrome: true }
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
    if (to.name === 'login' && auth.user) {
      const next =
        typeof to.query.next === 'string' ? to.query.next : '/';
      return next;
    }

    return true;
  }

  if (!auth.user) {
    return {
      name: 'login',
      query: { next: to.fullPath }
    };
  }

  return true;
});
