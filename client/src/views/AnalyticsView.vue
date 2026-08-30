<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import VChart from 'vue-echarts';
import { useProjectStore } from '../stores/project.ts';
import { findBoardBackground } from '../composables/board-backgrounds.ts';
import {
  statusPieOption,
  weeksLineOption,
  workloadBarOption,
  workloadChartHeight,
} from '../composables/analytics-charts.ts';
import type { AnalyticsPeriod, AnalyticsRiskKind } from '../types/index.ts';

const route = useRoute();
const router = useRouter();
const projects = useProjectStore();
const projectId = computed(() => String(route.params.projectId));
const period = ref<AnalyticsPeriod>('30d');
const rangeFrom = ref('');
const rangeTo = ref('');

function toDateInput(value: string | Date | null | undefined): string {
  if (!value) {
    return '';
  }

  const date = typeof value === 'string' ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

function syncRangeFromPayload(): void {
  if (!projects.analytics) {
    return;
  }

  rangeFrom.value = toDateInput(projects.analytics.from);
  rangeTo.value = toDateInput(projects.analytics.to);
}

watch(
  projectId,
  (id, prevId) => {
    if (prevId !== undefined && id !== prevId) {
      period.value = '30d';
    }

    void load();
  },
  { immediate: true },
);

async function requestAnalytics(): Promise<void> {
  if (period.value === 'custom') {
    await projects.fetchAnalytics(projectId.value, 'custom', {
      from: rangeFrom.value,
      to: rangeTo.value,
    });
  } else {
    await projects.fetchAnalytics(projectId.value, period.value);
  }

  syncRangeFromPayload();
}

async function load(): Promise<void> {
  projects.analytics = null;
  await requestAnalytics();
}

async function setPeriod(next: AnalyticsPeriod): Promise<void> {
  if (next === 'custom' || period.value === next || projects.isLoading) {
    return;
  }

  period.value = next;
  await requestAnalytics();
}

async function applyCustomRange(): Promise<void> {
  if (
    !rangeFrom.value
    || !rangeTo.value
    || rangeFrom.value > rangeTo.value
    || projects.isLoading
  ) {
    return;
  }

  period.value = 'custom';
  await requestAnalytics();
}

function barWidth(count: number, max: number): string {
  if (max <= 0) {
    return count > 0 ? '100%' : '0%';
  }

  return `${Math.min(100, Math.round((count / max) * 100))}%`;
}

function openBoard(query: Record<string, string> = {}): void {
  void router.push({
    name: 'project',
    params: { projectId: projectId.value },
    query,
  });
}

function openRisk(cardId: string): void {
  openBoard({ card: cardId });
}

function onStatusClick(raw: unknown): void {
  if (typeof raw !== 'object' || raw === null) {
    return;
  }

  const event = raw as {
    componentType?: string;
    data?: unknown;
  };

  if (event.componentType !== 'series') {
    return;
  }

  if (typeof event.data !== 'object' || event.data === null) {
    return;
  }

  const data = event.data as { columnId?: unknown };

  if (typeof data.columnId !== 'string' || data.columnId === '') {
    return;
  }

  openBoard({ column: data.columnId });
}

function riskKindLabel(kind: AnalyticsRiskKind): string {
  if (kind === 'overdue') {
    return 'Просрочено';
  }

  if (kind === 'dueSoon') {
    return 'Срок на неделе';
  }

  return 'Пробелы';
}

const selectedBackground = computed(
  () => projects.current?.boardBackground ?? 'default',
);

const hasBoardPhoto = computed(() => Boolean(findBoardBackground(selectedBackground.value).full));

const statusOption = computed(() => {
  const rows = projects.analytics?.byStatus ?? [];

  if (!rows.some((row) => row.count > 0)) {
    return null;
  }

  return statusPieOption(rows);
});

const weeksOption = computed(() => {
  const weeks = projects.analytics?.weeks ?? [];

  if (!weeks.length) {
    return null;
  }

  return weeksLineOption(weeks);
});

const activeWorkload = computed(() => (
  projects.analytics?.workload ?? []
).filter((row) => row.hours > 0));

const workloadOption = computed(() => {
  if (!activeWorkload.value.length) {
    return null;
  }

  return workloadBarOption(activeWorkload.value);
});

const workloadHeight = computed(() => workloadChartHeight(activeWorkload.value.length));
</script>

<template>
  <div :class="{ 'has-photo': hasBoardPhoto }">
    <div class="analytics-bar">
      <div class="filter">
        <button
          type="button"
          class="btn btn-ghost"
          :class="{ 'is-active': period === 'today' }"
          :disabled="projects.isLoading"
          @click="setPeriod('today')"
        >
          Сегодня
        </button>
        <button
          type="button"
          class="btn btn-ghost"
          :class="{ 'is-active': period === '7d' }"
          :disabled="projects.isLoading"
          @click="setPeriod('7d')"
        >
          7 дней
        </button>
        <button
          type="button"
          class="btn btn-ghost"
          :class="{ 'is-active': period === '30d' }"
          :disabled="projects.isLoading"
          @click="setPeriod('30d')"
        >
          30 дней
        </button>
        <button
          type="button"
          class="btn btn-ghost"
          :class="{ 'is-active': period === 'quarter' }"
          :disabled="projects.isLoading"
          @click="setPeriod('quarter')"
        >
          Квартал
        </button>
        <button
          type="button"
          class="btn btn-ghost"
          :class="{ 'is-active': period === 'year' }"
          :disabled="projects.isLoading"
          @click="setPeriod('year')"
        >
          Год
        </button>
        <button
          type="button"
          class="btn btn-ghost"
          :class="{ 'is-active': period === '3y' }"
          :disabled="projects.isLoading"
          @click="setPeriod('3y')"
        >
          3 года
        </button>
        <button
          type="button"
          class="btn btn-ghost"
          :class="{ 'is-active': period === '5y' }"
          :disabled="projects.isLoading"
          @click="setPeriod('5y')"
        >
          5 лет
        </button>
      </div>
      <div
        v-if="projects.analytics"
        class="analytics-range"
        :class="{ 'is-active': period === 'custom' }"
      >
        <input
          v-model="rangeFrom"
          class="input"
          type="date"
          :max="rangeTo || undefined"
          :disabled="projects.isLoading"
          aria-label="Дата начала"
          @change="applyCustomRange"
        >
        <span class="muted">–</span>
        <input
          v-model="rangeTo"
          class="input"
          type="date"
          :min="rangeFrom || undefined"
          :disabled="projects.isLoading"
          aria-label="Дата конца"
          @change="applyCustomRange"
        >
      </div>
    </div>
    <p
      v-if="projects.isLoading && !projects.analytics"
      class="muted"
    >
      Загрузка…
    </p>
    <template v-else-if="projects.analytics">
      <div class="stats-grid mb-16">
        <button
          type="button"
          class="panel stat"
          @click="openBoard()"
        >
          <div class="label">
            Карточки
          </div>
          <div class="value">
            {{ projects.analytics.summary.cards }}
          </div>
        </button>
        <button
          type="button"
          class="panel stat"
          @click="openBoard({ due: 'overdue' })"
        >
          <div class="label">
            Просрочено
          </div>
          <div class="value neg">
            {{ projects.analytics.summary.overdue }}
          </div>
        </button>
        <button
          type="button"
          class="panel stat"
          @click="openBoard({ assignee: 'none' })"
        >
          <div class="label">
            Без исполнителя
          </div>
          <div class="value">
            {{ projects.analytics.summary.noAssignee }}
          </div>
        </button>
        <button
          type="button"
          class="panel stat"
          @click="openBoard({ estimate: 'none' })"
        >
          <div class="label">
            Без оценки
          </div>
          <div class="value">
            {{ projects.analytics.summary.noEstimate }}
          </div>
        </button>
        <button
          v-if="projects.analytics.releasesEnabled"
          type="button"
          class="panel stat"
          @click="openBoard({ release: 'none' })"
        >
          <div class="label">
            Без релиза
          </div>
          <div class="value">
            {{ projects.analytics.summary.noRelease }}
          </div>
        </button>
      </div>
      <div class="grid-2 mb-16">
        <div class="panel">
          <div class="panel-head">
            <h2>Задачи по статусам</h2>
          </div>
          <VChart
            v-if="statusOption"
            class="chart"
            :option="statusOption"
            autoresize
            @click="onStatusClick"
          />
          <p
            v-else
            class="muted"
          >
            Нет карточек
          </p>
        </div>
        <div class="panel">
          <div class="panel-head">
            <h2>Списания по неделям</h2>
          </div>
          <VChart
            v-if="weeksOption"
            class="chart"
            :option="weeksOption"
            autoresize
          />
          <p
            v-else
            class="muted"
          >
            Нет списаний за период
          </p>
        </div>
      </div>
      <div class="grid-2 mb-16">
        <div class="panel">
          <div class="panel-head">
            <h2>Загрузка участников</h2>
          </div>
          <VChart
            v-if="workloadOption"
            class="chart"
            :style="{ height: `${workloadHeight}px` }"
            :option="workloadOption"
            autoresize
          />
          <p
            v-else
            class="muted"
          >
            Нет списаний за период
          </p>
        </div>
        <div class="panel">
          <div class="panel-head">
            <h2>План и факт</h2>
          </div>
          <div class="meter">
            <div class="meter-head">
              <span>Часы</span>
              <span>
                {{ projects.analytics.planVsFact.factHours }}
                /
                {{ projects.analytics.planVsFact.planHours }} ч
              </span>
            </div>
            <div class="meter-track">
              <div
                class="meter-fill"
                :class="{
                  'is-over':
                    projects.analytics.planVsFact.factHours >
                    projects.analytics.planVsFact.planHours
                }"
                :style="{
                  width: barWidth(
                    projects.analytics.planVsFact.factHours,
                    projects.analytics.planVsFact.planHours
                  )
                }"
              />
            </div>
          </div>
          <p class="muted tight">
            План — все карточки, факт — выбранный период
          </p>
        </div>
      </div>
      <div :class="{ 'grid-2': projects.analytics.releasesEnabled }">
        <div
          v-if="projects.analytics.releasesEnabled"
          class="panel"
        >
          <div class="panel-head">
            <h2>Релизы</h2>
          </div>
          <div
            v-for="row in projects.analytics.releases"
            :key="row.id ?? 'none'"
            class="release-row"
          >
            <div class="release-head">
              <span>{{ row.name }}</span>
              <span
                v-if="row.status"
                class="badge"
                :class="
                  row.status === 'released'
                    ? 'badge-released'
                    : 'badge-planned'
                "
              >
                {{ row.status }}
              </span>
            </div>
            <div class="bar-track">
              <div
                class="bar-fill"
                :style="{ width: barWidth(row.done, row.total) }"
              />
            </div>
            <div class="muted">
              {{ row.done }}/{{ row.total }} ·
              {{ row.planHours }}/{{ row.factHours }} ч
            </div>
          </div>
          <p
            v-if="!projects.analytics.releases.length"
            class="muted"
          >
            Нет релизов
          </p>
        </div>
        <div class="panel">
          <div class="panel-head">
            <h2>Риски</h2>
          </div>
          <button
            v-for="(risk, index) in projects.analytics.risks"
            :key="`${risk.cardId}-${risk.kind}-${index}`"
            type="button"
            class="list-row"
            @click="openRisk(risk.cardId)"
          >
            <span
              class="kind-dot"
              :class="`kind-dot--${risk.kind}`"
            />
            <div class="grow">
              <div>{{ risk.title }}</div>
              <div class="muted">
                {{
                  risk.kind === 'gaps'
                    ? risk.detail
                    : riskKindLabel(risk.kind)
                }}
              </div>
            </div>
          </button>
          <p
            v-if="!projects.analytics.risks.length"
            class="muted"
          >
            Рисков нет
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
@use '../assets/breakpoints' as *;

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
}

.stat {
  padding: 16px;
  width: 100%;
  color: inherit;
  text-align: left;

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

button.stat:hover {
  background: var(--bg);
  box-shadow: var(--shadow-hover);
}

.chart {
  width: 100%;
  height: 260px;
}

.meter {
  margin-bottom: 14px;
}

.meter-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
  font-size: 13px;
}

.meter-track,
.bar-track {
  height: 8px;
  border-radius: 999px;
  background: var(--selected);
  overflow: hidden;
}

.meter-fill,
.bar-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--blue);
}

.meter-fill.is-over,
.bar-fill.is-over {
  background: var(--danger);
}

.neg {
  color: var(--danger);
}

.release-row {
  display: flex;
  flex-direction: column;
  gap: 6px;

  & + & {
    margin-top: 14px;
  }
}

.release-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
}

.kind-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--muted);

  &--overdue {
    background: var(--danger);
  }

  &--dueSoon {
    background: var(--warning);
  }

  &--gaps {
    background: var(--blue);
  }
}

.analytics-bar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.analytics-range {
  display: flex;
  align-items: center;
  gap: 8px;

  .input {
    width: auto;
  }

  &.is-active .input {
    border-color: var(--blue);
  }
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

.has-photo {
  .analytics-bar .muted {
    color: rgb(255 255 255 / 80%);
  }

  .analytics-range .input {
    background: var(--surface);
    color: var(--text);
  }

  .filter {
    .btn,
    .btn-ghost {
      background: transparent;
      color: var(--text);

      &:hover:not(:disabled) {
        background: var(--hover);
        color: var(--text);
      }
    }

    button.is-active,
    button.is-active:hover:not(:disabled) {
      background: var(--surface);
      color: var(--blue);
    }
  }
}

@media (max-width: $bp-phone) {
  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }

  .analytics-range {
    width: 100%;
    flex-wrap: wrap;

    .input {
      flex: 1;
      min-width: 0;
      width: auto;
    }
  }
}

@media (max-width: $bp-narrow) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
