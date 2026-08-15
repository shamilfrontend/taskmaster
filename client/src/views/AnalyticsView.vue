<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useProjectStore } from '../stores/project.ts';
import {
  boardBackgroundStyle,
  findBoardBackground
} from '../composables/board-backgrounds.ts';
import { formatDate, formatMoney } from '../composables/format.ts';
import { useProjectTabs } from '../composables/project-tabs.ts';
import PageTabs from '../components/PageTabs.vue';
import type { AnalyticsPeriod } from '../types/index.ts';

const route = useRoute();
const projects = useProjectStore();
const projectId = computed(() => String(route.params.projectId));
const period = ref<AnalyticsPeriod>('30d');

onMounted(() => {
  void load();
});

async function load(): Promise<void> {
  await Promise.all([
    projects.fetchOne(projectId.value),
    projects.fetchAnalytics(projectId.value, period.value)
  ]);
}

async function setPeriod(next: AnalyticsPeriod): Promise<void> {
  period.value = next;
  await projects.fetchAnalytics(projectId.value, period.value);
}

function barWidth(count: number, max: number): string {
  if (max <= 0) {
    return '0%';
  }

  return `${Math.round((count / max) * 100)}%`;
}

const selectedBackground = computed(
  () => projects.current?.boardBackground ?? 'default'
);

const hasBoardPhoto = computed(() =>
  Boolean(findBoardBackground(selectedBackground.value).full)
);

const boardStyle = computed(() => {
  if (!hasBoardPhoto.value) {
    return undefined;
  }

  return boardBackgroundStyle(selectedBackground.value);
});

const tabs = useProjectTabs(
  projectId,
  computed(() => projects.current?.role ?? projects.analytics?.role),
  computed(
    () =>
      projects.current?.releasesEnabled ??
      projects.analytics?.releasesEnabled ??
      false
  )
);

const statsGridClass = computed(() => {
  const extras =
    Number(projects.analytics?.releasesEnabled) +
    Number(projects.analytics?.budgetEnabled);

  if (extras === 2) {
    return 'grid-4';
  }

  if (extras === 1) {
    return 'grid-3';
  }

  return 'grid-2';
});
</script>

<template>
  <section v-if="projects.analytics" class="screen is-active">
    <div
      class="board-screen"
      :class="{ 'has-photo': hasBoardPhoto }"
      :style="boardStyle"
    >
      <div class="page-head">
        <h1>{{ projects.current?.name ?? 'Аналитика' }}</h1>
      </div>
      <PageTabs :tabs="tabs" />
      <div class="page-head">
        <p>
          {{ formatDate(projects.analytics.from) }} –
          {{ formatDate(projects.analytics.to) }}
        </p>
        <div class="filter">
          <button
            type="button"
            class="btn btn-ghost"
            :class="{ 'is-active': period === '7d' }"
            @click="setPeriod('7d')"
          >
            7 дней
          </button>
          <button
            type="button"
            class="btn btn-ghost"
            :class="{ 'is-active': period === '30d' }"
            @click="setPeriod('30d')"
          >
            30 дней
          </button>
          <button
            type="button"
            class="btn btn-ghost"
            :class="{ 'is-active': period === 'quarter' }"
            @click="setPeriod('quarter')"
          >
            Квартал
          </button>
        </div>
      </div>
      <div class="mb-16" :class="statsGridClass">
        <div class="panel stat">
          <div class="label">Карточки</div>
          <div class="value">{{ projects.analytics.summary.cards }}</div>
        </div>
        <div class="panel stat">
          <div class="label">Просрочено</div>
          <div class="value neg">{{ projects.analytics.summary.overdue }}</div>
        </div>
        <div
          v-if="projects.analytics.releasesEnabled"
          class="panel stat"
        >
          <div class="label">Без релиза</div>
          <div class="value">{{ projects.analytics.summary.noRelease }}</div>
        </div>
        <div
          v-if="projects.analytics.budgetEnabled"
          class="panel stat"
        >
          <div class="label">Факт за период</div>
          <div class="value">{{ formatMoney(projects.analytics.summary.factAmount) }}</div>
        </div>
      </div>
      <div class="grid-2">
        <div class="panel">
          <div class="panel-head">
            <h2>Задачи по статусам</h2>
          </div>
          <div class="bars">
            <div
              v-for="row in projects.analytics.byStatus"
              :key="row.columnId"
              class="bar-row"
            >
              <span>{{ row.name }}</span>
              <div class="bar-track">
                <div
                  class="bar-fill"
                  :style="{ width: barWidth(row.count, projects.analytics.summary.cards) }"
                />
              </div>
              <span>{{ row.count }}</span>
            </div>
          </div>
        </div>
        <div v-if="projects.analytics.budgetEnabled" class="panel">
          <div class="panel-head">
            <h2>Финансы</h2>
          </div>
          <p class="muted tight">
            Часы: {{ projects.analytics.planVsFact.planHours }} /
            {{ projects.analytics.planVsFact.factHours }}
          </p>
          <p
            v-if="projects.analytics.planVsFact.planAmount !== undefined"
            class="muted tight"
          >
            Сумма:
            {{ formatMoney(projects.analytics.planVsFact.planAmount) }}
            /
            {{ formatMoney(projects.analytics.planVsFact.factAmount) }}
          </p>
          <p v-if="projects.analytics.burn" class="muted tight">
            Остаток {{ formatMoney(projects.analytics.burn.remainder) }}
          </p>
        </div>
        <div class="panel">
          <div class="panel-head">
            <h2>Загрузка участников</h2>
          </div>
          <div class="bars">
            <div
              v-for="row in projects.analytics.workload"
              :key="row.userId"
              class="bar-row bar-row--wide"
            >
              <span>{{ row.displayName }}</span>
              <span class="end">
                {{ row.hours }}ч
                <template v-if="projects.analytics.budgetEnabled">
                  · {{ formatMoney(row.amount) }}
                </template>
              </span>
            </div>
          </div>
        </div>
        <div v-if="projects.analytics.releasesEnabled" class="panel">
          <div class="panel-head">
            <h2>Релизы</h2>
          </div>
          <div
            v-for="row in projects.analytics.releases"
            :key="row.id ?? 'none'"
            class="bar-row bar-row--wide"
          >
            <span>{{ row.name }}</span>
            <span class="end">{{ row.done }}/{{ row.total }} · {{ row.planHours }}/{{ row.factHours }}ч</span>
          </div>
        </div>
        <div v-if="projects.analytics.budgetEnabled" class="panel">
          <div class="panel-head">
            <h2>Списания по неделям</h2>
          </div>
          <div
            v-for="(week, index) in projects.analytics.weeks"
            :key="index"
            class="bar-row bar-row--wide"
          >
            <span>{{ formatDate(week.from) }}</span>
            <span class="end">{{ formatMoney(week.amount) }}</span>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head">
            <h2>Риски</h2>
          </div>
          <div
            v-for="(risk, index) in projects.analytics.risks"
            :key="index"
            class="list-row"
          >
            <div class="grow">
              <div>{{ risk.title }}</div>
              <div class="muted">{{ risk.detail }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.stat {
  padding: 16px;

  .label {
    color: var(--muted);
    font-size: 12px;
    font-weight: 500;
  }

  .value {
    margin-top: 6px;
    font-size: 24px;
    font-weight: 600;
    letter-spacing: -0.02em;

    &.neg {
      color: var(--danger);
    }
  }
}

.bars {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bar-row {
  display: grid;
  grid-template-columns: 110px 1fr 48px;
  gap: 10px;
  align-items: center;
  font-size: 13px;

  &--wide {
    grid-template-columns: 120px 1fr 118px;
  }

  .end {
    text-align: right;
    white-space: nowrap;
    color: var(--muted);
    font-size: 12px;
  }
}

.bar-track {
  height: 8px;
  border-radius: 999px;
  background: var(--selected);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--blue);
}

.filter {
  display: flex;
  gap: 4px;
  padding: 3px;
  border-radius: var(--radius);
  background: var(--input-bg);

  .btn {
    padding: 4px 10px;
  }

  button.is-active,
  button.is-active:hover:not(:disabled) {
    background: var(--surface);
    color: var(--blue);
    border-color: transparent;
    box-shadow: var(--shadow);
  }
}
</style>
