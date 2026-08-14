<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useProjectStore } from '../stores/project.ts';
import { formatDate, formatMoney } from '../composables/format.ts';
import type { AnalyticsPeriod } from '../types/index.ts';

const route = useRoute();
const projects = useProjectStore();
const projectId = computed(() => String(route.params.projectId));
const period = ref<AnalyticsPeriod>('30d');

onMounted(() => {
  void load();
});

async function load(): Promise<void> {
  await projects.fetchAnalytics(projectId.value, period.value);
}

async function setPeriod(next: AnalyticsPeriod): Promise<void> {
  period.value = next;
  await load();
}

function barWidth(count: number, max: number): string {
  if (max <= 0) {
    return '0%';
  }

  return `${Math.round((count / max) * 100)}%`;
}
</script>

<template>
  <section v-if="projects.analytics" class="screen is-active">
    <div class="wrap wrap--wide">
      <div class="page-head">
        <div>
          <h1>Аналитика</h1>
          <p>
            {{ formatDate(projects.analytics.from) }} –
            {{ formatDate(projects.analytics.to) }}
          </p>
        </div>
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
      <div class="grid-4 mb-16">
        <div class="panel stat">
          <div class="label">Карточки</div>
          <div class="value">{{ projects.analytics.summary.cards }}</div>
        </div>
        <div class="panel stat">
          <div class="label">Просрочено</div>
          <div class="value neg">{{ projects.analytics.summary.overdue }}</div>
        </div>
        <div class="panel stat">
          <div class="label">Без релиза</div>
          <div class="value">{{ projects.analytics.summary.noRelease }}</div>
        </div>
        <div class="panel stat">
          <div class="label">Факт за период</div>
          <div class="value">{{ formatMoney(projects.analytics.summary.factAmount) }}</div>
        </div>
      </div>
      <div class="grid-2">
        <div class="panel">
          <h2>Задачи по статусам</h2>
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
        <div class="panel">
          <h2>План vs факт</h2>
          <p class="muted tight mb-12">
            Часы: {{ projects.analytics.planVsFact.planHours }} /
            {{ projects.analytics.planVsFact.factHours }}
          </p>
        </div>
        <div v-if="projects.analytics.burn" class="panel">
          <h2>Сгорание бюджета</h2>
          <p class="muted tight mb-12">
            Остаток {{ formatMoney(projects.analytics.burn.remainder) }}
          </p>
        </div>
        <div class="panel">
          <h2>Загрузка участников</h2>
          <div class="bars">
            <div
              v-for="row in projects.analytics.workload"
              :key="row.userId"
              class="bar-row bar-row--wide"
            >
              <span>{{ row.displayName }}</span>
              <span class="end">{{ row.hours }}ч · {{ formatMoney(row.amount) }}</span>
            </div>
          </div>
        </div>
        <div class="panel">
          <h2>Релизы</h2>
          <div
            v-for="row in projects.analytics.releases"
            :key="row.id ?? 'none'"
            class="bar-row bar-row--wide"
          >
            <span>{{ row.name }}</span>
            <span class="end">{{ row.done }}/{{ row.total }} · {{ row.planHours }}/{{ row.factHours }}ч</span>
          </div>
        </div>
        <div class="panel">
          <h2>Списания по неделям</h2>
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
          <h2>Риски</h2>
          <div
            v-for="(risk, index) in projects.analytics.risks"
            :key="index"
            class="project-row"
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
