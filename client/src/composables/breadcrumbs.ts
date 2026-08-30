import { computed, watch, type ComputedRef } from 'vue';
import { useRoute, type RouteLocationRaw } from 'vue-router';
import { useBoardStore } from '../stores/board.ts';
import { useProjectStore } from '../stores/project.ts';
import { useTeamsStore } from '../stores/teams.ts';

export interface Crumb {
  label: string;
  to?: RouteLocationRaw;
}

const PROJECT_ROUTE_NAMES = new Set([
  'project',
  'project-releases',
  'project-settings',
  'analytics',
  'release',
]);

export function useBreadcrumbs(): { crumbs: ComputedRef<Crumb[]> } {
  const route = useRoute();
  const teams = useTeamsStore();
  const project = useProjectStore();
  const board = useBoardStore();

  async function loadParents(): Promise<void> {
    const { name } = route;

    // TeamView owns fetch for route `team`
    if (name === 'team') {
      return;
    }

    if (name === 'my-tasks') {
      return;
    }

    if (typeof name === 'string' && PROJECT_ROUTE_NAMES.has(name)) {
      const projectId = String(route.params.projectId);

      if (project.current?.id !== projectId) {
        await project.fetchOne(projectId);
      }

      const teamId = project.current?.teamId;

      if (teamId && teams.current?.id !== teamId) {
        await teams.fetchOne(teamId);
      }
    }

    if (name === 'release') {
      const releaseId = String(route.params.releaseId);

      if (board.release?.id !== releaseId) {
        await board.fetchRelease(releaseId);
      }
    }
  }

  watch(
    () => route.fullPath,
    () => {
      void loadParents();
    },
    { immediate: true },
  );

  const crumbs = computed((): Crumb[] => {
    const { name } = route;
    const teamId = teams.current?.id;
    const teamName = teams.current?.name;
    const projectId = project.current?.id;
    const projectName = project.current?.name;
    const teamCrumb: Crumb | null = teamId && teamName
      ? { label: teamName, to: { name: 'team', params: { teamId } } }
      : null;
    const projectCrumb: Crumb | null = projectId && projectName
      ? { label: projectName, to: { name: 'project', params: { projectId } } }
      : null;
    const releasesCrumb: Crumb | null = projectId
      ? {
        label: 'Релизы',
        to: { name: 'project-releases', params: { projectId } },
      }
      : null;

    if (name === 'team' && teamName && teamId === String(route.params.teamId)) {
      return [{ label: teamName }];
    }

    if (name === 'my-tasks') {
      return [{ label: 'Мои задачи' }];
    }

    const projectMatches = Boolean(
      teamCrumb
      && projectCrumb
      && projectName
      && projectId === String(route.params.projectId)
      && project.current?.teamId === teamId,
    );

    if (name === 'project' && projectMatches && teamCrumb && projectName) {
      return [teamCrumb, { label: projectName }];
    }

    if (name === 'project-releases' && projectMatches && teamCrumb && projectCrumb) {
      return [teamCrumb, projectCrumb, { label: 'Релизы' }];
    }

    if (name === 'project-settings' && projectMatches && teamCrumb && projectCrumb) {
      return [teamCrumb, projectCrumb, { label: 'Настройки' }];
    }

    if (name === 'analytics' && projectMatches && teamCrumb && projectCrumb) {
      return [teamCrumb, projectCrumb, { label: 'Аналитика' }];
    }

    if (
      name === 'release'
      && projectMatches
      && teamCrumb
      && projectCrumb
      && releasesCrumb
      && board.release
      && board.release.id === String(route.params.releaseId)
      && board.release.projectId === projectId
    ) {
      return [
        teamCrumb,
        projectCrumb,
        releasesCrumb,
        { label: board.release.name },
      ];
    }

    return [];
  });

  return { crumbs };
}
