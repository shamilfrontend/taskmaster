import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import App from './App.vue';

async function mountApp(): Promise<ReturnType<typeof mount>> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/',
        component: { template: '<div class="route-stub">route</div>' },
        meta: { chrome: false },
      },
    ],
  });

  await router.push('/');
  await router.isReady();

  return mount(App, {
    global: {
      plugins: [router],
      stubs: {
        AppHeader: true,
        Notifications: true,
      },
    },
  });
}

describe('App', () => {
  it('matches snapshot', async () => {
    const wrapper = await mountApp();

    expect(wrapper.html()).toMatchSnapshot();
  });
});
