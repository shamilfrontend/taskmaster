<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ModalDialog from '../components/ModalDialog.vue';
import { formatDate, formatMoney } from '../composables/format.ts';
import { findBoardBackground } from '../composables/board-backgrounds.ts';
import { useAuthStore } from '../stores/auth.ts';
import { useProjectStore } from '../stores/project.ts';
import { useTimesheetStore } from '../stores/timesheet.ts';
import type {
  TimesheetEntry,
  TimesheetLoggableCard,
  TimesheetView,
} from '../types/index.ts';

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const TARGET_HOURS = 8;

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const projects = useProjectStore();
const timesheet = useTimesheetStore();

const projectId = computed(() => String(route.params.projectId));
const extraCardIds = ref<string[]>([]);

const hoursOpen = ref(false);
const dayEntriesOpen = ref(false);
const logOpen = ref(false);
const addCardOpen = ref(false);

const hours = ref(2);
const hoursWorkedAt = ref('');
const editingEntryId = ref<string | null>(null);
const activeCardId = ref<string | null>(null);
const activeDayKey = ref('');
const logCardId = ref('');
const logHoursValue = ref(2);
const logWorkedAt = ref('');
const addCardId = ref('');

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

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toDateInput(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseDay(value: string): Date {
  const parts = value.split('-').map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return new Date(year, month - 1, day);
}

function entryDayKey(entry: TimesheetEntry): string {
  return toDateInput(new Date(entry.workedAt));
}

const viewMode = computed<TimesheetView>(() => (
  route.query.view === 'list' ? 'list' : 'week'
));

const weekFrom = computed(() => {
  const raw = route.query.from;

  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  return toDateInput(weekStart(new Date()));
});

const selectedUserId = computed(() => {
  const raw = route.query.userId;

  if (typeof raw === 'string' && raw) {
    return raw;
  }

  return auth.user?.id ?? '';
});

const canAdmin = computed(() => {
  const role = projects.current?.role;
  const teamRole = projects.current?.teamRole;
  return role === 'owner' || role === 'admin' || teamRole === 'owner';
});

const selectedBackground = computed(
  () => projects.current?.boardBackground ?? 'default',
);

const hasBoardPhoto = computed(() => (
  Boolean(findBoardBackground(selectedBackground.value).full)
));

const isOwnWeek = computed(() => selectedUserId.value === auth.user?.id);

const canLogHours = computed(() => {
  const role = timesheet.data?.role ?? projects.current?.role;

  if (role === 'viewer') {
    return false;
  }

  return (timesheet.data?.loggableCards.length ?? 0) > 0;
});

const showMoney = computed(() => {
  const payload = timesheet.data;

  if (!payload?.budgetEnabled || payload.role === 'viewer') {
    return false;
  }

  if (payload.role === 'member') {
    return payload.entries.some((entry) => entry.amount !== undefined);
  }

  return true;
});

const weekDays = computed(() => {
  const start = parseDay(weekFrom.value);

  return WEEKDAY_LABELS.map((label, index) => {
    const date = addDays(start, index);

    return {
      label,
      key: toDateInput(date),
      date,
    };
  });
});

const weekTo = computed(() => toDateInput(addDays(parseDay(weekFrom.value), 6)));

const weekLabel = computed(() => {
  const start = parseDay(weekFrom.value);
  const end = addDays(start, 6);
  const startStr = start.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
  const endStr = end.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return `${startStr} – ${endStr}`;
});

interface GridRow {
  cardId: string;
  title: string;
  columnName: string;
}

const gridRows = computed((): GridRow[] => {
  const payload = timesheet.data;

  if (!payload) {
    return [];
  }

  const rows = new Map<string, GridRow>();

  for (const entry of payload.entries) {
    if (!rows.has(entry.cardId)) {
      rows.set(entry.cardId, {
        cardId: entry.cardId,
        title: entry.cardTitle,
        columnName: entry.columnName,
      });
    }
  }

  // В режиме "Неделя" важно, чтобы при выборе участника таблица содержала
  // и карточки без списаний (иначе выглядит, будто фильтр не применился).
  const targetUserId = selectedUserId.value;
  const isTargetSelf = targetUserId === auth.user?.id;

  for (const card of payload.loggableCards) {
    if (card.assigneeId === targetUserId && !rows.has(card.id)) {
      rows.set(card.id, {
        cardId: card.id,
        title: card.title,
        columnName: card.columnName,
      });
    }
  }

  // Дополнительные карточки показываем только если редактируем свою неделю.
  if (isTargetSelf) {
    for (const cardId of extraCardIds.value) {
      const card = payload.loggableCards.find((item) => item.id === cardId);

      if (card && !rows.has(card.id)) {
        rows.set(card.id, {
          cardId: card.id,
          title: card.title,
          columnName: card.columnName,
        });
      }
    }
  }

  return [...rows.values()].sort((left, right) => (
    left.title.localeCompare(right.title, 'ru')
  ));
});

const availableAddCards = computed(() => {
  const payload = timesheet.data;

  if (!payload) {
    return [];
  }

  const used = new Set(gridRows.value.map((row) => row.cardId));

  return payload.loggableCards.filter((card) => !used.has(card.id));
});

const dayEntries = computed(() => {
  if (!activeCardId.value || !activeDayKey.value) {
    return [];
  }

  return entriesForCell(activeCardId.value, activeDayKey.value);
});

const activeCardTitle = computed(() => {
  const payload = timesheet.data;

  if (!payload || !activeCardId.value) {
    return '';
  }

  return payload.entries.find((entry) => entry.cardId === activeCardId.value)?.cardTitle
    ?? payload.loggableCards.find((card) => card.id === activeCardId.value)?.title
    ?? '';
});

function entriesForCell(cardId: string, dayKey: string): TimesheetEntry[] {
  return timesheet.data?.entries.filter(
    (entry) => entry.cardId === cardId && entryDayKey(entry) === dayKey,
  ) ?? [];
}

function cellHours(cardId: string, dayKey: string): number {
  return entriesForCell(cardId, dayKey).reduce(
    (sum, entry) => sum + entry.hours,
    0,
  );
}

function dayTotal(dayKey: string): number {
  return timesheet.data?.entries
    .filter((entry) => entryDayKey(entry) === dayKey)
    .reduce((sum, entry) => sum + entry.hours, 0) ?? 0;
}

function rowTotal(cardId: string): number {
  return timesheet.data?.entries
    .filter((entry) => entry.cardId === cardId)
    .reduce((sum, entry) => sum + entry.hours, 0) ?? 0;
}

function canManageEntry(entry: TimesheetEntry): boolean {
  const role = timesheet.data?.role;

  if (role === 'owner' || role === 'admin') {
    return true;
  }

  const card = timesheet.data?.loggableCards.find(
    (item) => item.id === entry.cardId,
  );

  return (
    role === 'member'
    && entry.userId === auth.user?.id
    && card?.assigneeId === auth.user?.id
  );
}

function canEditCell(cardId: string): boolean {
  if (!canLogHours.value || !isOwnWeek.value) {
    return false;
  }

  const role = timesheet.data?.role;

  if (role === 'owner' || role === 'admin') {
    return true;
  }

  const card = timesheet.data?.loggableCards.find((item) => item.id === cardId);
  return card?.assigneeId === auth.user?.id;
}

function cellClass(hoursValue: number): Record<string, boolean> {
  return {
    'timesheet-cell--filled': hoursValue > 0,
    'timesheet-cell--over': hoursValue > TARGET_HOURS,
  };
}

function dayTotalClass(hoursValue: number): Record<string, boolean> {
  return {
    'timesheet-total--warn': hoursValue > 0 && hoursValue < TARGET_HOURS,
    'timesheet-total--ok': hoursValue >= TARGET_HOURS,
    'timesheet-total--over': hoursValue > TARGET_HOURS * weekDays.value.length,
  };
}

function updateQuery(patch: Record<string, string | undefined>): void {
  const nextQuery = { ...route.query };

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === '') {
      delete nextQuery[key];
    } else {
      nextQuery[key] = value;
    }
  }

  void router.replace({
    name: 'project-expenses',
    params: { projectId: projectId.value },
    query: nextQuery,
  });
}

function setView(next: TimesheetView): void {
  updateQuery({ view: next === 'week' ? undefined : next });
}

function setSelectedUser(userId: string): void {
  updateQuery({ userId: userId === auth.user?.id ? undefined : userId });
}

function shiftWeek(delta: number): void {
  const next = addDays(parseDay(weekFrom.value), delta * 7);
  updateQuery({ from: toDateInput(weekStart(next)) });
}

function resetWeek(): void {
  updateQuery({ from: undefined });
}

async function loadTimesheet(): Promise<void> {
  const options: {
    from: string;
    to: string;
    userId?: string;
  } = {
    from: weekFrom.value,
    to: weekTo.value,
  };

  if (viewMode.value === 'week') {
    options.userId = selectedUserId.value || undefined;
  } else if (canAdmin.value) {
    options.userId = undefined;
  }

  await timesheet.fetchTimesheet(projectId.value, options);
}

watch(
  [projectId, weekFrom, viewMode, selectedUserId, canAdmin],
  (values, prev) => {
    if (prev !== undefined && values[0] !== prev[0]) {
      extraCardIds.value = [];
      timesheet.reset();
    }

    void loadTimesheet();
  },
  { immediate: true },
);

function openBoardCard(cardId: string): void {
  void router.push({
    name: 'project',
    params: { projectId: projectId.value },
    query: { card: cardId },
  });
}

function openCreateHours(cardId: string, dayKey: string): void {
  dayEntriesOpen.value = false;
  activeCardId.value = cardId;
  activeDayKey.value = dayKey;
  hours.value = 2;
  hoursWorkedAt.value = dayKey;
  editingEntryId.value = null;
  hoursOpen.value = true;
}

function openEditHours(entry: TimesheetEntry): void {
  activeCardId.value = entry.cardId;
  activeDayKey.value = entryDayKey(entry);
  hours.value = entry.hours;
  hoursWorkedAt.value = entryDayKey(entry);
  editingEntryId.value = entry.id;
  hoursOpen.value = true;
  dayEntriesOpen.value = false;
}

function onCellClick(cardId: string, dayKey: string): void {
  if (!canEditCell(cardId)) {
    return;
  }

  const entries = entriesForCell(cardId, dayKey);

  if (entries.length === 0) {
    openCreateHours(cardId, dayKey);
    return;
  }

  if (entries.length === 1) {
    const entry = entries[0];

    if (entry && canManageEntry(entry)) {
      openEditHours(entry);
      return;
    }
  }

  activeCardId.value = cardId;
  activeDayKey.value = dayKey;
  dayEntriesOpen.value = true;
}

async function submitHours(): Promise<void> {
  if (!activeCardId.value) {
    return;
  }

  if (editingEntryId.value) {
    await timesheet.patchTimeEntry(editingEntryId.value, hours.value);
  } else {
    await timesheet.logHours(
      activeCardId.value,
      hours.value,
      hoursWorkedAt.value || undefined,
    );
  }

  hoursOpen.value = false;
  editingEntryId.value = null;
  await loadTimesheet();
}

async function removeEntry(entryId: string): Promise<void> {
  await timesheet.deleteTimeEntry(entryId);
  dayEntriesOpen.value = false;
  await loadTimesheet();
}

function openLogModal(): void {
  const first = timesheet.data?.loggableCards[0];
  logCardId.value = first?.id ?? '';
  logHoursValue.value = 2;
  logWorkedAt.value = toDateInput(new Date());
  logOpen.value = true;
}

async function submitLog(): Promise<void> {
  if (!logCardId.value) {
    return;
  }

  await timesheet.logHours(
    logCardId.value,
    logHoursValue.value,
    logWorkedAt.value || undefined,
  );
  logOpen.value = false;
  await loadTimesheet();
}

function openAddCardModal(): void {
  addCardId.value = availableAddCards.value[0]?.id ?? '';
  addCardOpen.value = true;
}

function confirmAddCard(): void {
  if (!addCardId.value || extraCardIds.value.includes(addCardId.value)) {
    addCardOpen.value = false;
    return;
  }

  extraCardIds.value = [...extraCardIds.value, addCardId.value];
  addCardOpen.value = false;
}

function cardLabel(card: TimesheetLoggableCard): string {
  return card.columnName
    ? `${card.title} · ${card.columnName}`
    : card.title;
}
</script>

<template>
  <div
    class="expenses-view"
    :class="{ 'has-photo': hasBoardPhoto }"
  >
    <div class="expenses-bar">
      <div class="filter">
        <button
          type="button"
          class="btn btn-ghost"
          :class="{ 'is-active': viewMode === 'week' }"
          :disabled="timesheet.isLoading"
          @click="setView('week')"
        >
          Неделя
        </button>
        <button
          type="button"
          class="btn btn-ghost"
          :class="{ 'is-active': viewMode === 'list' }"
          :disabled="timesheet.isLoading"
          @click="setView('list')"
        >
          Список
        </button>
      </div>

      <div class="week-nav">
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="timesheet.isLoading"
          aria-label="Предыдущая неделя"
          @click="shiftWeek(-1)"
        >
          ←
        </button>
        <button
          type="button"
          class="week-label btn btn-ghost"
          :disabled="timesheet.isLoading"
          @click="resetWeek"
        >
          {{ weekLabel }}
        </button>
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="timesheet.isLoading"
          aria-label="Следующая неделя"
          @click="shiftWeek(1)"
        >
          →
        </button>
      </div>

      <select
        v-if="viewMode === 'week' && canAdmin && timesheet.data?.members.length"
        class="input member-select"
        :value="selectedUserId"
        :disabled="timesheet.isLoading"
        @change="setSelectedUser(($event.target as HTMLSelectElement).value)"
      >
        <option
          v-for="member in timesheet.data.members"
          :key="member.id"
          :value="member.id"
        >
          {{ member.displayName }}
        </option>
      </select>

      <button
        v-if="canLogHours"
        type="button"
        class="btn"
        :disabled="timesheet.isLoading"
        @click="openLogModal"
      >
        Списать часы
      </button>
    </div>

    <p
      v-if="timesheet.isLoading && !timesheet.data"
      class="muted"
    >
      Загрузка…
    </p>
    <p
      v-else-if="timesheet.error"
      class="warn"
    >
      {{ timesheet.error }}
    </p>

    <template v-else-if="timesheet.data">
      <div
        v-if="viewMode === 'week'"
        class="panel timesheet-panel"
      >
        <div class="timesheet-scroll">
          <table class="timesheet-grid">
            <thead>
              <tr>
                <th class="timesheet-card-col">
                  Карточка
                </th>
                <th
                  v-for="day in weekDays"
                  :key="day.key"
                  class="timesheet-day-col"
                >
                  <span class="timesheet-day-label">{{ day.label }}</span>
                  <span class="timesheet-day-date">{{ day.date.getDate() }}</span>
                </th>
                <th class="timesheet-sum-col">
                  Итого
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in gridRows"
                :key="row.cardId"
              >
                <th
                  scope="row"
                  class="timesheet-card-cell"
                >
                  <button
                    type="button"
                    class="timesheet-card-link"
                    @click="openBoardCard(row.cardId)"
                  >
                    {{ row.title }}
                  </button>
                  <span
                    v-if="row.columnName"
                    class="muted timesheet-column"
                  >
                    {{ row.columnName }}
                  </span>
                </th>
                <td
                  v-for="day in weekDays"
                  :key="`${row.cardId}-${day.key}`"
                >
                  <button
                    type="button"
                    class="timesheet-cell"
                    :class="cellClass(cellHours(row.cardId, day.key))"
                    :disabled="!canEditCell(row.cardId)"
                    @click="onCellClick(row.cardId, day.key)"
                  >
                    {{
                      cellHours(row.cardId, day.key)
                        ? `${cellHours(row.cardId, day.key)} ч`
                        : '—'
                    }}
                  </button>
                </td>
                <td class="timesheet-row-total">
                  {{ rowTotal(row.cardId) ? `${rowTotal(row.cardId)} ч` : '—' }}
                </td>
              </tr>
              <tr v-if="!gridRows.length">
                <td
                  :colspan="weekDays.length + 2"
                  class="muted timesheet-empty"
                >
                  {{
                    isOwnWeek
                      ? 'Нет карточек для учёта. Добавьте карточку или спишите часы.'
                      : 'На этой неделе списаний нет.'
                  }}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">
                  Итого
                </th>
                <td
                  v-for="day in weekDays"
                  :key="`total-${day.key}`"
                  class="timesheet-total"
                  :class="dayTotalClass(dayTotal(day.key))"
                >
                  {{ dayTotal(day.key) ? `${dayTotal(day.key)} ч` : '—' }}
                </td>
                <td class="timesheet-row-total">
                  {{ timesheet.data.totals.hours }} ч
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div
          v-if="isOwnWeek && canLogHours && availableAddCards.length"
          class="timesheet-actions"
        >
          <button
            type="button"
            class="btn btn-ghost"
            @click="openAddCardModal"
          >
            Добавить карточку
          </button>
        </div>
      </div>

      <div
        v-else
        class="panel"
      >
        <div
          v-if="timesheet.data.entries.length"
          class="costs-table"
        >
          <div class="costs-row costs-row--head">
            <span>Дата</span>
            <span>Карточка</span>
            <span>Участник</span>
            <span>Часы</span>
            <span v-if="showMoney">Сумма</span>
            <span
              class="costs-actions"
              aria-hidden="true"
            />
          </div>
          <div
            v-for="entry in timesheet.data.entries"
            :key="entry.id"
            class="costs-row"
            :class="{ 'costs-row--money': showMoney }"
          >
            <span>{{ formatDate(entry.workedAt) }}</span>
            <span>
              <button
                type="button"
                class="timesheet-card-link"
                @click="openBoardCard(entry.cardId)"
              >
                {{ entry.cardTitle }}
              </button>
              <span
                v-if="entry.columnName"
                class="muted timesheet-column"
              >
                {{ entry.columnName }}
              </span>
            </span>
            <span class="costs-user">{{ entry.displayName }}</span>
            <span>{{ entry.hours }} ч</span>
            <span v-if="showMoney">{{ formatMoney(entry.amount) }}</span>
            <div class="costs-actions row-actions">
              <template v-if="canManageEntry(entry)">
                <button
                  type="button"
                  class="btn btn-ghost"
                  @click="openEditHours(entry)"
                >
                  Изменить
                </button>
                <button
                  type="button"
                  class="btn btn-ghost"
                  @click="removeEntry(entry.id)"
                >
                  Удалить
                </button>
              </template>
            </div>
          </div>
        </div>
        <p
          v-else
          class="muted"
        >
          Списаний за выбранную неделю нет
        </p>

        <div
          v-if="showMoney && timesheet.data.totals.amount !== undefined"
          class="timesheet-list-total"
        >
          Итого: {{ timesheet.data.totals.hours }} ч ·
          {{ formatMoney(timesheet.data.totals.amount) }}
        </div>
        <div
          v-else
          class="timesheet-list-total"
        >
          Итого: {{ timesheet.data.totals.hours }} ч
        </div>
      </div>
    </template>

    <ModalDialog
      :open="hoursOpen"
      :title="editingEntryId ? 'Изменить списание' : 'Списать часы'"
      @close="hoursOpen = false"
    >
      <p
        v-if="activeCardTitle"
        class="muted modal-card-title"
      >
        {{ activeCardTitle }}
      </p>
      <div class="field">
        <label>Часы</label>
        <input
          v-model.number="hours"
          class="input"
          type="number"
          min="0.5"
          max="24"
          step="0.5"
          placeholder="0.5"
        >
      </div>
      <div
        v-if="!editingEntryId"
        class="field"
      >
        <label>Дата</label>
        <input
          v-model="hoursWorkedAt"
          class="input"
          type="date"
        >
      </div>
      <div class="modal-foot">
        <button
          type="button"
          class="btn btn-ghost"
          @click="hoursOpen = false"
        >
          Отмена
        </button>
        <button
          type="button"
          class="btn"
          @click="submitHours"
        >
          {{ editingEntryId ? 'Сохранить' : 'Списать' }}
        </button>
      </div>
    </ModalDialog>

    <ModalDialog
      :open="dayEntriesOpen"
      title="Списания за день"
      @close="dayEntriesOpen = false"
    >
      <p
        v-if="activeCardTitle"
        class="muted modal-card-title"
      >
        {{ activeCardTitle }} · {{ formatDate(activeDayKey) }}
      </p>
      <div
        v-for="entry in dayEntries"
        :key="entry.id"
        class="day-entry-row"
      >
        <span>{{ entry.hours }} ч</span>
        <div
          v-if="canManageEntry(entry)"
          class="row-actions"
        >
          <button
            type="button"
            class="btn btn-ghost"
            @click="openEditHours(entry)"
          >
            Изменить
          </button>
          <button
            type="button"
            class="btn btn-ghost"
            @click="removeEntry(entry.id)"
          >
            Удалить
          </button>
        </div>
      </div>
      <div
        v-if="activeCardId && canEditCell(activeCardId)"
        class="modal-foot"
      >
        <button
          type="button"
          class="btn"
          @click="openCreateHours(activeCardId, activeDayKey)"
        >
          Добавить списание
        </button>
      </div>
    </ModalDialog>

    <ModalDialog
      :open="logOpen"
      title="Списать часы"
      @close="logOpen = false"
    >
      <div class="field">
        <label>Карточка</label>
        <select
          v-model="logCardId"
          class="input"
        >
          <option
            v-for="card in timesheet.data?.loggableCards ?? []"
            :key="card.id"
            :value="card.id"
          >
            {{ cardLabel(card) }}
          </option>
        </select>
      </div>
      <div class="field">
        <label>Часы</label>
        <input
          v-model.number="logHoursValue"
          class="input"
          type="number"
          min="0.5"
          max="24"
          step="0.5"
        >
      </div>
      <div class="field">
        <label>Дата</label>
        <input
          v-model="logWorkedAt"
          class="input"
          type="date"
        >
      </div>
      <div class="modal-foot">
        <button
          type="button"
          class="btn btn-ghost"
          @click="logOpen = false"
        >
          Отмена
        </button>
        <button
          type="button"
          class="btn"
          @click="submitLog"
        >
          Списать
        </button>
      </div>
    </ModalDialog>

    <ModalDialog
      :open="addCardOpen"
      title="Добавить карточку"
      @close="addCardOpen = false"
    >
      <div class="field">
        <label>Карточка</label>
        <select
          v-model="addCardId"
          class="input"
        >
          <option
            v-for="card in availableAddCards"
            :key="card.id"
            :value="card.id"
          >
            {{ cardLabel(card) }}
          </option>
        </select>
      </div>
      <div class="modal-foot">
        <button
          type="button"
          class="btn btn-ghost"
          @click="addCardOpen = false"
        >
          Отмена
        </button>
        <button
          type="button"
          class="btn"
          @click="confirmAddCard"
        >
          Добавить
        </button>
      </div>
    </ModalDialog>
  </div>
</template>

<style lang="scss" scoped>
.expenses-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.has-photo {
  // На некоторых фонах var(--text)/var(--muted) становится недостаточно контрастным.
  // Делать через `!important` не будем: вместо этого переопределим переменные
  // локально в рамках экрана.
  --text: #fff;
  --muted: rgb(255 255 255 / 90%);

  .expenses-bar .muted {
    color: var(--muted);
  }

  // В Analytics этот экран получает более высокий контраст для кнопок на фото,
  // здесь тоже нужно явно переопределить цвет, т.к. текущая тема может
  // оставлять `var(--muted)` слишком тусклым.
  .btn.btn-ghost {
    background: transparent;
    color: var(--text);

    &:hover:not(:disabled) {
      background: var(--hover);
      color: var(--text);
    }
  }

  .btn.btn-ghost:disabled {
    color: rgb(255 255 255 / 70%);
  }

  .week-label.btn.btn-ghost,
  .filter .btn-ghost,
  .filter .btn-ghost:hover:not(:disabled) {
    background: transparent;
    color: #000;
  }

  // Для active-состояния переключателя Неделя/Список:
  // глобальная тема для фото даёт белый текст на светлом фоне.
  // Здесь поднимаем специфичность и возвращаем контраст.
  .filter button.btn.is-active,
  .filter button.btn.is-active:hover:not(:disabled) {
    background: var(--surface);
    color: var(--blue);
    border-color: transparent;
    box-shadow: var(--shadow);
  }

  // Отдельно для строки навигации недели (week-nav), т.к. она может
  // наследовать недостаточный контраст от базовых стилей.
  .week-nav {
    .btn.btn-ghost,
    .btn-ghost {
      background: transparent;
      color: var(--text);

      &:hover:not(:disabled) {
        background: var(--hover);
        color: var(--text);
      }
    }

    .week-label {
      color: var(--text);
    }
  }

  .member-select {
    background: var(--surface);
    color: var(--text);
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

.week-nav {
  display: flex;
  align-items: center;
  gap: 4px;
}

.week-label {
  min-width: 180px;
  font-weight: 600;
}

.member-select {
  width: auto;
  min-width: 180px;
}

.timesheet-panel {
  padding: 0;
  overflow: hidden;
}

.timesheet-scroll {
  overflow: auto;
}

.timesheet-grid {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
  font-size: 13px;

  th,
  td {
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
  }

  thead th {
    padding: 10px 8px;
    background: var(--bg);
    color: var(--muted);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    text-align: center;
  }

  tbody th,
  tbody td,
  tfoot th,
  tfoot td {
    padding: 6px 8px;
  }

  tbody th {
    text-align: left;
    font-weight: 500;
  }
}

.timesheet-card-col {
  min-width: 220px;
  text-align: left !important;
}

.timesheet-day-col {
  width: 72px;
}

.timesheet-day-label {
  display: block;
}

.timesheet-day-date {
  display: block;
  margin-top: 2px;
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
}

.timesheet-sum-col,
.timesheet-row-total {
  width: 72px;
  text-align: center;
  font-weight: 600;
}

.timesheet-card-cell {
  max-width: 260px;
}

.timesheet-card-link {
  display: inline;
  padding: 0;
  border: 0;
  background: none;
  color: var(--blue);
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.timesheet-column {
  display: block;
  margin-top: 2px;
  font-size: 11px;
}

.timesheet-cell {
  display: block;
  width: 100%;
  min-height: 36px;
  padding: 6px 4px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--muted);
  font: inherit;
  text-align: center;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: var(--border);
    background: var(--hover);
    color: var(--text);
  }

  &:disabled {
    cursor: default;
  }

  &--filled {
    color: var(--text);
    font-weight: 600;
  }

  &--over {
    color: var(--danger);
  }
}

.timesheet-total {
  text-align: center;
  font-weight: 600;

  &--warn {
    color: var(--warning);
  }

  &--ok {
    color: var(--blue);
  }

  &--over {
    color: var(--danger);
  }
}

.timesheet-empty {
  padding: 24px 12px;
  text-align: center;
}

.timesheet-actions {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
}

.timesheet-list-total {
  margin-top: 16px;
  font-weight: 600;
}

.costs-table {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.costs-row {
  display: grid;
  grid-template-columns: 130px minmax(0, 1.4fr) minmax(0, 1fr) 56px 148px;
  gap: 8px;
  align-items: center;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;

  &--money {
    grid-template-columns: 130px minmax(0, 1.4fr) minmax(0, 1fr) 56px 90px 148px;
  }

  &:last-child {
    border-bottom: 0;
  }

  &--head {
    background: var(--bg);
    color: #000;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
}

.costs-user {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.costs-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  min-height: 24px;
  min-width: 0;
}

.modal-card-title {
  margin: 0 0 12px;
}

.day-entry-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);

  &:last-child {
    border-bottom: 0;
  }
}

@media (max-width: 800px) {
  .expenses-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .member-select,
  .week-label {
    width: 100%;
  }
}
</style>
