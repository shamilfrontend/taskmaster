import { computed, type ComputedRef } from 'vue';
import type { PageTab } from '../components/PageTabs.vue';
import type { TeamRole } from '../types/index.ts';

export function useProjectTabs(
  projectId: ComputedRef<string>,
  role: ComputedRef<TeamRole | undefined>,
  releasesEnabled: ComputedRef<boolean>,
  teamRole: ComputedRef<TeamRole | undefined>,
): ComputedRef<PageTab[]> {
  return computed(() => {
    const items: PageTab[] = [
      {
        id: 'board',
        label: 'Доска',
        to: { name: 'project', params: { projectId: projectId.value } },
      },
    ];

    if (releasesEnabled.value) {
      items.push({
        id: 'releases',
        label: 'Релизы',
        to: {
          name: 'project-releases',
          params: { projectId: projectId.value },
        },
      });
    }

    items.push({
      id: 'analytics',
      label: 'Аналитика',
      to: { name: 'analytics', params: { projectId: projectId.value } },
    });

    if (
      role.value === 'owner'
      || role.value === 'admin'
      || teamRole.value === 'owner'
    ) {
      items.push({
        id: 'settings',
        label: 'Настройки',
        to: {
          name: 'project-settings',
          params: { projectId: projectId.value },
        },
      });
    }

    return items;
  });
}
