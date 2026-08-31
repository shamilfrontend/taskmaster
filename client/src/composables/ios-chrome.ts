import {
  onUnmounted,
  ref,
  watch,
  type MaybeRefOrGetter,
  type Ref,
  toValue,
} from 'vue';
import { useRoute, type RouteLocationRaw } from 'vue-router';
import { useBoardStore } from '../stores/board.ts';
import { useProjectStore } from '../stores/project.ts';
import { useTeamsStore } from '../stores/teams.ts';
import { useBreadcrumbs } from './breadcrumbs.ts';

export interface IosNavAction {
  id: string;
  label: string;
  handler: () => void;
}

export interface IosBackLink {
  label: string;
  to: RouteLocationRaw;
}

export const iosRightAction = ref<IosNavAction | null>(null);
let actionOwner: symbol | null = null;

export function useIosChrome(): {
  rightAction: Ref<IosNavAction | null>;
  setRightAction: (action: IosNavAction | null) => void;
} {
  const owner = Symbol('ios-chrome');

  function setRightAction(action: IosNavAction | null): void {
    iosRightAction.value = action;
    actionOwner = owner;
  }

  onUnmounted(() => {
    if (actionOwner === owner) {
      iosRightAction.value = null;
      actionOwner = null;
    }
  });

  return { rightAction: iosRightAction, setRightAction };
}

export function useIosNavAction(
  action: MaybeRefOrGetter<IosNavAction | null>,
): void {
  const { setRightAction } = useIosChrome();

  watch(
    () => toValue(action),
    (next) => {
      setRightAction(next);
    },
    { immediate: true },
  );
}

const PROJECT_ROUTE_NAMES = new Set([
  'project',
  'project-releases',
  'project-settings',
  'project-members',
  'analytics',
]);

export function useIosNavigation(): {
  title: Ref<string>;
  back: Ref<IosBackLink | null>;
} {
  const route = useRoute();
  const teams = useTeamsStore();
  const project = useProjectStore();
  const board = useBoardStore();
  useBreadcrumbs();

  const title = ref('TaskMaster');
  const back = ref<IosBackLink | null>(null);

  watch(
    () => [
      route.name,
      route.params.teamId,
      route.params.projectId,
      route.params.releaseId,
      teams.current?.id,
      teams.current?.name,
      project.current?.id,
      project.current?.name,
      project.current?.teamId,
      board.release?.id,
      board.release?.name,
    ] as const,
    () => {
      const { name } = route;

      if (name === 'teams') {
        title.value = 'Команды';
        back.value = null;
        return;
      }

      if (name === 'my-tasks') {
        title.value = 'Мои задачи';
        back.value = null;
        return;
      }

      if (name === 'notifications') {
        title.value = 'Уведомления';
        back.value = null;
        return;
      }

      if (name === 'more') {
        title.value = 'Ещё';
        back.value = null;
        return;
      }

      if (name === 'team') {
        const matches = teams.current?.id === String(route.params.teamId);
        title.value = matches && teams.current?.name
          ? teams.current.name
          : 'Команда';
        back.value = { label: 'Команды', to: { name: 'teams' } };
        return;
      }

      if (name === 'release') {
        const matches = board.release?.id === String(route.params.releaseId);
        title.value = matches && board.release?.name
          ? board.release.name
          : 'Релиз';
        back.value = {
          label: 'Релизы',
          to: {
            name: 'project-releases',
            params: { projectId: String(route.params.projectId) },
          },
        };
        return;
      }

      if (typeof name === 'string' && PROJECT_ROUTE_NAMES.has(name)) {
        const matches = project.current?.id === String(route.params.projectId);
        title.value = matches && project.current?.name
          ? project.current.name
          : 'Проект';
        const teamId = project.current?.teamId;
        back.value = teamId
          ? {
            label: teams.current?.name ?? 'Назад',
            to: { name: 'team', params: { teamId } },
          }
          : null;
        return;
      }

      title.value = 'TaskMaster';
      back.value = null;
    },
    { immediate: true },
  );

  return { title, back };
}
