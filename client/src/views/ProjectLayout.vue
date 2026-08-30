<script setup lang="ts">
import { computed, watch } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import { useBoardStore } from '../stores/board.ts';
import { useProjectStore } from '../stores/project.ts';
import {
  boardBackgroundStyle,
  findBoardBackground,
} from '../composables/board-backgrounds.ts';
import { useProjectTabs } from '../composables/project-tabs.ts';
import PageTabs from '../components/PageTabs.vue';

const route = useRoute();
const router = useRouter();
const projects = useProjectStore();
const board = useBoardStore();
const projectId = computed(() => String(route.params.projectId));

watch(projectId, async (id) => {
  if (projects.current?.id !== id) {
    projects.current = null;
    board.reset();
  }

  await projects.fetchOne(id);
}, { immediate: true });

const canAdmin = computed(() => {
  const role = projects.current?.role;
  const teamRole = projects.current?.teamRole;
  return role === 'owner' || role === 'admin' || teamRole === 'owner';
});

watch(
  () => [projects.current, route.name] as const,
  () => {
    const project = projects.current;

    if (!project || project.id !== projectId.value) {
      return;
    }

    const { name } = route;
    const releasesOn = Boolean(project.releasesEnabled);
    const analyticsOn = Boolean(project.analyticsEnabled);

    if (
      (name === 'project-releases' || name === 'release')
      && !releasesOn
    ) {
      void router.replace({
        name: 'project',
        params: { projectId: projectId.value },
      });
      return;
    }

    if (name === 'analytics' && !analyticsOn) {
      void router.replace({
        name: 'project',
        params: { projectId: projectId.value },
      });
      return;
    }

    if (name === 'project-settings' && !canAdmin.value) {
      void router.replace({
        name: 'project',
        params: { projectId: projectId.value },
      });
    }
  },
  { immediate: true },
);

const selectedBackground = computed(
  () => projects.current?.boardBackground ?? 'default',
);

const hasBoardPhoto = computed(() => Boolean(findBoardBackground(selectedBackground.value).full));

const boardStyle = computed(() => {
  if (!hasBoardPhoto.value) {
    return undefined;
  }

  return boardBackgroundStyle(selectedBackground.value);
});

const tabs = useProjectTabs(
  projectId,
  computed(() => projects.current?.role),
  computed(() => Boolean(projects.current?.releasesEnabled)),
  computed(() => Boolean(projects.current?.analyticsEnabled)),
  computed(() => projects.current?.teamRole),
);

const isRouteAllowed = computed(() => {
  const project = projects.current;

  if (!project) {
    return false;
  }

  const { name } = route;
  const releasesOn = Boolean(project.releasesEnabled);
  const analyticsOn = Boolean(project.analyticsEnabled);

  if ((name === 'project-releases' || name === 'release') && !releasesOn) {
    return false;
  }

  if (name === 'analytics' && !analyticsOn) {
    return false;
  }

  if (name === 'project-settings' && !canAdmin.value) {
    return false;
  }

  return true;
});
</script>

<template>
  <section
    v-if="projects.current"
    class="screen is-active"
  >
    <div
      class="board-screen"
      :class="{ 'has-photo': hasBoardPhoto }"
      :style="boardStyle"
    >
      <div class="page-head">
        <div>
          <h1>{{ projects.current.name }}</h1>
        </div>
      </div>
      <PageTabs :tabs="tabs" />
      <p
        v-if="projects.error"
        class="warn"
      >
        {{ projects.error }}
      </p>
      <RouterView v-if="isRouteAllowed" />
    </div>
  </section>
  <section
    v-else-if="projects.error"
    class="screen is-active"
  >
    <p class="warn">
      {{ projects.error }}
    </p>
  </section>
</template>
