<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { formatDate, isOverdue } from '../composables/format.ts';
import { useMyTasksStore } from '../stores/my-tasks.ts';
import type { MyTaskItem } from '../types/index.ts';

type TaskGroupId =
  | 'overdue'
  | 'today'
  | 'week'
  | 'later'
  | 'none'
  | 'done';

const GROUP_ORDER: Array<{ id: TaskGroupId; label: string }> = [
  { id: 'overdue', label: 'Просрочено' },
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: 'На этой неделе' },
  { id: 'later', label: 'Позже' },
  { id: 'none', label: 'Без срока' },
  { id: 'done', label: 'Готово' },
];

const route = useRoute();
const router = useRouter();
const myTasks = useMyTasksStore();

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function weekStart(date: Date): Date {
  const copy = startOfDay(date);
  const weekday = copy.getDay();
  const offset = weekday === 0 ? 6 : weekday - 1;
  copy.setDate(copy.getDate() - offset);
  return copy;
}

function taskGroup(task: MyTaskItem): TaskGroupId {
  if (task.isDone) {
    return 'done';
  }

  if (!task.dueDate) {
    return 'none';
  }

  if (isOverdue(task.dueDate, false)) {
    return 'overdue';
  }

  const due = startOfDay(new Date(task.dueDate));
  const today = startOfDay(new Date());

  if (due.getTime() === today.getTime()) {
    return 'today';
  }

  const weekEnd = weekStart(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  if (due.getTime() < weekEnd.getTime()) {
    return 'week';
  }

  return 'later';
}

const includeDone = computed(() => route.query.done === '1');
const teamId = computed(() => (
  typeof route.query.teamId === 'string' ? route.query.teamId : ''
));
const projectId = computed(() => (
  typeof route.query.projectId === 'string' ? route.query.projectId : ''
));

const projectOptions = computed(() => {
  const projects = myTasks.data?.projects ?? [];

  if (!teamId.value) {
    return projects;
  }

  return projects.filter((project) => project.teamId === teamId.value);
});

const groups = computed(() => {
  const items = myTasks.data?.items ?? [];
  const byGroup = new Map<TaskGroupId, MyTaskItem[]>();

  items.forEach((item) => {
    const id = taskGroup(item);
    const list = byGroup.get(id) ?? [];
    list.push(item);
    byGroup.set(id, list);
  });

  return GROUP_ORDER
    .map((group) => ({
      ...group,
      items: byGroup.get(group.id) ?? [],
    }))
    .filter((group) => group.items.length > 0);
});

function patchQuery(patch: Record<string, string | undefined>): void {
  const next: Record<string, string> = {};

  const current = {
    done: includeDone.value ? '1' : undefined,
    teamId: teamId.value || undefined,
    projectId: projectId.value || undefined,
    ...patch,
  };

  Object.entries(current).forEach(([key, value]) => {
    if (value) {
      next[key] = value;
    }
  });

  void router.replace({ name: 'my-tasks', query: next });
}

function setTeam(value: string): void {
  const stillValid = Boolean(
    projectId.value
    && (
      !value
      || (myTasks.data?.projects ?? []).some(
        (project) => project.id === projectId.value && project.teamId === value,
      )
    ),
  );

  patchQuery({
    teamId: value || undefined,
    projectId: stillValid ? projectId.value : undefined,
  });
}

function setProject(value: string): void {
  patchQuery({ projectId: value || undefined });
}

function setIncludeDone(value: boolean): void {
  patchQuery({ done: value ? '1' : undefined });
}

function taskSubtitle(task: MyTaskItem): string {
  const context = [
    task.teamName,
    task.projectName,
    task.columnName,
    task.releaseName,
  ].filter(Boolean).join(' · ');
  const extras: string[] = [];

  if (task.estimateHours > 0) {
    extras.push(`${task.estimateHours} ч`);
  }

  if (task.checklistTotal > 0) {
    extras.push(`${task.checklistDone}/${task.checklistTotal}`);
  }

  if (extras.length === 0) {
    return context;
  }

  return context ? `${context} · ${extras.join(' · ')}` : extras.join(' · ');
}

function openTask(task: MyTaskItem): void {
  void router.push({
    name: 'project',
    params: { projectId: task.projectId },
    query: { card: task.id },
  });
}

watch(
  [includeDone, teamId, projectId],
  () => {
    void myTasks.fetchTasks({
      done: includeDone.value,
      teamId: teamId.value || undefined,
      projectId: projectId.value || undefined,
    });
  },
  { immediate: true },
);
</script>

<template>
  <section class="screen is-active">
    <div class="wrap">
      <div class="page-head">
        <div>
          <h1>Мои задачи</h1>
          <p>Карточки, где вы исполнитель</p>
        </div>
      </div>

      <div class="task-filters mb-16">
        <select
          class="input select-inline"
          :value="teamId"
          :disabled="myTasks.isLoading"
          aria-label="Команда"
          @change="setTeam(($event.target as HTMLSelectElement).value)"
        >
          <option value="">
            Все команды
          </option>
          <option
            v-for="team in myTasks.data?.teams ?? []"
            :key="team.id"
            :value="team.id"
          >
            {{ team.name }}
          </option>
        </select>
        <select
          class="input select-inline"
          :value="projectId"
          :disabled="myTasks.isLoading"
          aria-label="Проект"
          @change="setProject(($event.target as HTMLSelectElement).value)"
        >
          <option value="">
            Все проекты
          </option>
          <option
            v-for="project in projectOptions"
            :key="project.id"
            :value="project.id"
          >
            {{ project.name }}
          </option>
        </select>
        <label class="choice">
          <input
            type="checkbox"
            :checked="includeDone"
            :disabled="myTasks.isLoading"
            @change="setIncludeDone(
              ($event.target as HTMLInputElement).checked,
            )"
          >
          <span>Показать готовые</span>
        </label>
      </div>

      <p
        v-if="myTasks.isLoading && !myTasks.data"
        class="muted"
      >
        Загрузка…
      </p>
      <p
        v-else-if="myTasks.error"
        class="warn"
      >
        {{ myTasks.error }}
      </p>
      <p
        v-else-if="myTasks.data && !myTasks.data.items.length"
        class="muted"
      >
        Нет назначенных задач
      </p>
      <div
        v-else
        class="stack"
      >
        <div
          v-for="group in groups"
          :key="group.id"
          class="panel"
        >
          <div class="panel-head">
            <h2>{{ group.label }}</h2>
            <span class="muted">{{ group.items.length }}</span>
          </div>
          <button
            v-for="task in group.items"
            :key="task.id"
            type="button"
            class="list-row"
            @click="openTask(task)"
          >
            <div class="grow">
              <div>{{ task.title }}</div>
              <div class="muted">
                {{ taskSubtitle(task) }}
              </div>
            </div>
            <span
              v-if="task.dueDate"
              class="muted"
              :class="{ 'is-overdue': isOverdue(task.dueDate, task.isDone) }"
            >
              {{ formatDate(task.dueDate) }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
@use '../assets/breakpoints' as *;

.task-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.select-inline {
  min-width: 180px;
}

@media (max-width: $bp-phone) {
  .task-filters {
    .select-inline,
    .choice {
      width: 100%;
      min-width: 0;
    }
  }
}
</style>
