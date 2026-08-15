import { computed, watch, type ComputedRef } from 'vue';
import { useRoute, type RouteLocationRaw } from 'vue-router';
import { useBoardStore } from '../stores/board.ts';
import { useProjectStore } from '../stores/project.ts';
import { useTeamsStore } from '../stores/teams.ts';

export interface Crumb {
  label: string;
  to?: RouteLocationRaw;
}

export function useBreadcrumbs(): { crumbs: ComputedRef<Crumb[]> } {
  const route = useRoute();
  const teams = useTeamsStore();
  const project = useProjectStore();
  const board = useBoardStore();

  async function loadParents(): Promise<void> {
    const name = route.name;

    // TeamView owns fetch for route `team`
    if (name === 'team') {
      return;
    }

    if (name === 'project' || name === 'analytics') {
      const projectId = String(route.params.projectId);

      if (project.current?.id !== projectId) {
        await project.fetchOne(projectId);
      }

      const teamId = project.current?.teamId;

      if (teamId && teams.current?.id !== teamId) {
        await teams.fetchOne(teamId);
      }

      return;
    }

    if (name === 'release') {
      const releaseId = String(route.params.releaseId);

      if (board.release?.id !== releaseId) {
        await board.fetchRelease(releaseId);
      }

      const projectId = board.release?.projectId;

      if (projectId && project.current?.id !== projectId) {
        await project.fetchOne(projectId);
      }

      const teamId = project.current?.teamId;

      if (teamId && teams.current?.id !== teamId) {
        await teams.fetchOne(teamId);
      }
    }
  }

  watch(
    () => route.fullPath,
    () => {
      void loadParents();
    },
    { immediate: true }
  );

  const crumbs = computed((): Crumb[] => {
    const name = route.name;
    const teamId = teams.current?.id;
    const teamName = teams.current?.name;
    const projectId = project.current?.id;
    const projectName = project.current?.name;
    const teamCrumb: Crumb | null =
      teamId && teamName
        ? { label: teamName, to: { name: 'team', params: { teamId } } }
        : null;
    const projectCrumb: Crumb | null =
      projectId && projectName
        ? { label: projectName, to: { name: 'project', params: { projectId } } }
        : null;

    if (name === 'team' && teamName && teamId === String(route.params.teamId)) {
      return [{ label: teamName }];
    }

    if (
      name === 'project' &&
      teamCrumb &&
      projectCrumb &&
      projectName &&
      projectId === String(route.params.projectId) &&
      project.current?.teamId === teamId
    ) {
      if (route.query.tab === 'releases' && project.current?.releasesEnabled) {
        return [teamCrumb, projectCrumb, { label: 'Релизы' }];
      }

      return [teamCrumb, { label: projectName }];
    }

    if (
      name === 'analytics' &&
      teamCrumb &&
      projectCrumb &&
      projectId === String(route.params.projectId) &&
      project.current?.teamId === teamId
    ) {
      return [teamCrumb, projectCrumb, { label: 'Аналитика' }];
    }

    if (
      name === 'release' &&
      teamCrumb &&
      projectCrumb &&
      board.release &&
      board.release.id === String(route.params.releaseId) &&
      board.release.projectId === projectId &&
      project.current?.teamId === teamId
    ) {
      return [teamCrumb, projectCrumb, { label: board.release.name }];
    }

    return [];
  });

  return { crumbs };
}
