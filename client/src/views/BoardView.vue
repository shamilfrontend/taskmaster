<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useBoardStore } from '../stores/board.ts';
import { useProjectStore } from '../stores/project.ts';
import {
  formatDate,
  initials,
  labelClass
} from '../composables/format.ts';
import ModalDialog from '../components/ModalDialog.vue';
import type { BoardCard, BoardColumn, LabelColor } from '../types/index.ts';

const CARD_DRAG = 'card:';
const COLUMN_DRAG = 'column:';

const route = useRoute();
const board = useBoardStore();
const project = useProjectStore();
const boardId = computed(() => String(route.params.boardId));
const cardOpen = ref(false);
const hoursOpen = ref(false);
const labelsOpen = ref(false);
const hours = ref(2);
const comment = ref('');
const labelName = ref('');
const labelColor = ref<LabelColor>('blue');
const renamingId = ref<string | null>(null);
const renameValue = ref('');
const menuColumnId = ref<string | null>(null);
const addingCardColumnId = ref<string | null>(null);
const newCardTitle = ref('');
const addingColumn = ref(false);
const newColumnName = ref('');

onMounted(() => {
  document.addEventListener('click', closeMenus);
});

onUnmounted(() => {
  document.removeEventListener('click', closeMenus);
});

watch(boardId, async (id) => {
  renamingId.value = null;
  menuColumnId.value = null;
  addingCardColumnId.value = null;
  addingColumn.value = false;
  cardOpen.value = false;
  await board.fetchBoard(id);

  if (board.current) {
    await project.fetchOne(board.current.projectId);
  }
}, { immediate: true });

watch(addingCardColumnId, async (id) => {
  if (!id) {
    return;
  }

  await nextTick();
  document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus();
});

watch(addingColumn, async (open) => {
  if (!open) {
    return;
  }

  await nextTick();
  document.querySelector<HTMLInputElement>('.add-list .input')?.focus();
});

watch(renamingId, async (id) => {
  if (!id) {
    return;
  }

  await nextTick();
  const input = document.querySelector<HTMLInputElement>('.column-title-input');
  input?.focus();
  input?.select();
});

const canEdit = computed(() => {
  const role = board.current?.role;
  return role === 'owner' || role === 'admin' || role === 'member';
});

const canAdmin = computed(() => {
  const role = board.current?.role;
  return role === 'owner' || role === 'admin';
});

function closeMenus(): void {
  menuColumnId.value = null;
}

function cardsOf(id: string): BoardCard[] {
  return (board.current?.cards ?? [])
    .filter((card) => card.columnId === id)
    .slice()
    .sort((a, b) => a.position - b.position);
}

async function openCard(id: string): Promise<void> {
  await board.fetchCard(id);
  cardOpen.value = true;
}

function toggleMenu(columnId: string): void {
  menuColumnId.value = menuColumnId.value === columnId ? null : columnId;
}

function startRename(column: BoardColumn): void {
  if (!canAdmin.value) {
    return;
  }

  renamingId.value = column.id;
  renameValue.value = column.name;
  menuColumnId.value = null;
}

async function saveRename(columnId: string): Promise<void> {
  const name = renameValue.value.trim();
  const currentName = board.current?.columns.find((item) => item.id === columnId)
    ?.name;
  renamingId.value = null;

  if (!name || name === currentName) {
    return;
  }

  await board.patchColumn(columnId, { name });
}

async function markDone(columnId: string, isDone: boolean): Promise<void> {
  menuColumnId.value = null;
  await board.patchColumn(columnId, { isDone });
}

async function removeColumn(columnId: string): Promise<void> {
  menuColumnId.value = null;
  await board.deleteColumn(columnId);
}

function openCardComposer(columnId: string): void {
  addingCardColumnId.value = columnId;
  newCardTitle.value = '';
  addingColumn.value = false;
  menuColumnId.value = null;
}

function cancelCardComposer(): void {
  addingCardColumnId.value = null;
  newCardTitle.value = '';
}

async function submitCard(columnId: string): Promise<void> {
  const title = newCardTitle.value.trim();

  if (!title) {
    return;
  }

  await board.createCard({
    boardId: boardId.value,
    columnId,
    title
  });
  newCardTitle.value = '';
  await nextTick();
  document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus();
}

function openColumnComposer(): void {
  addingColumn.value = true;
  newColumnName.value = '';
  addingCardColumnId.value = null;
  menuColumnId.value = null;
}

function cancelColumnComposer(): void {
  addingColumn.value = false;
  newColumnName.value = '';
}

async function submitColumn(): Promise<void> {
  const name = newColumnName.value.trim();

  if (!name || !board.current) {
    return;
  }

  await board.addColumn(board.current.id, name);
  newColumnName.value = '';
  await nextTick();
  document.querySelector<HTMLInputElement>('.add-list .input')?.focus();
}

function onColumnDragStart(event: DragEvent, columnId: string): void {
  const target = event.target as HTMLElement | null;

  if (target?.closest('button, input') || !canAdmin.value) {
    event.preventDefault();
    return;
  }

  event.dataTransfer?.setData('text/plain', `${COLUMN_DRAG}${columnId}`);
}

function onCardDragStart(event: DragEvent, cardId: string): void {
  event.dataTransfer?.setData('text/plain', `${CARD_DRAG}${cardId}`);
}

async function onDrop(event: DragEvent, targetColumnId: string): Promise<void> {
  const raw = event.dataTransfer?.getData('text/plain') ?? '';

  if (raw.startsWith(COLUMN_DRAG) && canAdmin.value) {
    const dragId = raw.slice(COLUMN_DRAG.length);
    const columns = board.current?.columns ?? [];
    const from = columns.findIndex((item) => item.id === dragId);
    const to = columns.findIndex((item) => item.id === targetColumnId);

    if (from < 0 || to < 0 || from === to) {
      return;
    }

    const ordered = columns.map((item) => item.id);
    const moved = ordered[from];

    if (moved === undefined) {
      return;
    }

    ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    await board.reorderColumns(ordered);
    return;
  }

  if (!raw.startsWith(CARD_DRAG) || !canEdit.value) {
    return;
  }

  const cardId = raw.slice(CARD_DRAG.length);
  const siblings = cardsOf(targetColumnId);
  await board.moveCard(cardId, targetColumnId, siblings.length);
  await board.fetchBoard(boardId.value);
}

async function logHours(): Promise<void> {
  if (!board.card) {
    return;
  }

  await board.logHours(board.card.id, hours.value);
  hoursOpen.value = false;
}

async function sendComment(): Promise<void> {
  if (!board.card || !comment.value.trim()) {
    return;
  }

  await board.addComment(board.card.id, comment.value);
  comment.value = '';
}

async function saveLabels(): Promise<void> {
  if (!board.current) {
    return;
  }

  await board.addLabel(board.current.id, labelName.value, labelColor.value);
  labelName.value = '';
}
</script>

<template>
  <section v-if="board.current" class="screen is-active">
    <div class="board-screen">
      <div class="board-toolbar">
        <div>
          <h1 class="board-title">{{ board.current.name }}</h1>
        </div>
        <div class="actions">
          <button v-if="canAdmin" type="button" class="btn btn-ghost" @click="labelsOpen = true">
            Метки
          </button>
        </div>
      </div>
      <p v-if="board.error" class="warn">{{ board.error }}</p>
      <div class="columns">
        <div
          v-for="column in board.current.columns"
          :key="column.id"
          class="column"
          @dragover.prevent
          @drop="onDrop($event, column.id)"
        >
          <div
            class="column-head"
            :draggable="canAdmin && renamingId !== column.id"
            @dragstart="onColumnDragStart($event, column.id)"
          >
            <input
              v-if="renamingId === column.id"
              v-model="renameValue"
              class="column-title-input"
              type="text"
              @click.stop
              @keydown.enter.prevent="saveRename(column.id)"
              @keydown.escape.prevent="renamingId = null"
              @blur="saveRename(column.id)"
            >
            <h2
              v-else
              :class="{ 'is-editable': canAdmin }"
              @click="startRename(column)"
            >
              {{ column.name }}
            </h2>
            <span class="count">{{ cardsOf(column.id).length }}</span>
            <button
              v-if="canAdmin"
              type="button"
              class="column-menu-btn"
              @click.stop="toggleMenu(column.id)"
            >
              ⋯
            </button>
            <div
              v-if="menuColumnId === column.id"
              class="column-menu"
              @click.stop
            >
              <button type="button" @click="startRename(column)">
                Переименовать
              </button>
              <button
                v-if="!column.isDone"
                type="button"
                @click="markDone(column.id, true)"
              >
                Отметить как Готово
              </button>
              <button
                v-else
                type="button"
                @click="markDone(column.id, false)"
              >
                Снять отметку Готово
              </button>
              <button
                type="button"
                class="is-danger"
                @click="removeColumn(column.id)"
              >
                Удалить
              </button>
            </div>
          </div>
          <div class="column-cards">
            <button
              v-for="card in cardsOf(column.id)"
              :key="card.id"
              type="button"
              class="task"
              draggable="true"
              @dragstart="onCardDragStart($event, card.id)"
              @click="openCard(card.id)"
            >
              <span v-if="card.releaseName" class="release-chip">{{ card.releaseName }}</span>
              <h3>{{ card.title }}</h3>
              <div class="labels">
                <span
                  v-for="labelId in card.labelIds"
                  :key="labelId"
                  :class="labelClass(board.current.labels.find((item) => item.id === labelId)?.color ?? 'blue')"
                >
                  {{ board.current.labels.find((item) => item.id === labelId)?.name }}
                </span>
              </div>
              <div class="task-foot">
                <span v-if="card.assigneeName" class="avatar sm">
                  {{ initials(card.assigneeName) }}
                </span>
                <span>{{ formatDate(card.dueDate) }}</span>
                <span class="hours">план {{ card.estimateHours }}ч · факт {{ card.factHours }}ч</span>
              </div>
            </button>
          </div>
          <div v-if="canEdit" class="composer">
            <template v-if="addingCardColumnId === column.id">
              <textarea
                v-model="newCardTitle"
                placeholder="Название карточки…"
                @keydown.enter.exact.prevent="submitCard(column.id)"
                @keydown.escape="cancelCardComposer"
              />
              <div class="composer-actions">
                <button type="button" class="btn" @click="submitCard(column.id)">
                  Добавить
                </button>
                <button type="button" class="icon-btn" @click="cancelCardComposer">
                  ×
                </button>
              </div>
            </template>
            <button
              v-else
              type="button"
              class="add-card-btn"
              @click="openCardComposer(column.id)"
            >
              + Добавить карточку
            </button>
          </div>
        </div>
        <div v-if="canAdmin" class="add-list">
          <div v-if="addingColumn" class="composer">
            <input
              v-model="newColumnName"
              class="input"
              type="text"
              placeholder="Название колонки…"
              @keydown.enter.prevent="submitColumn"
              @keydown.escape="cancelColumnComposer"
            >
            <div class="composer-actions">
              <button type="button" class="btn" @click="submitColumn">
                Добавить колонку
              </button>
              <button type="button" class="icon-btn" @click="cancelColumnComposer">
                ×
              </button>
            </div>
          </div>
          <button
            v-else
            type="button"
            class="add-list-btn"
            @click="openColumnComposer"
          >
            + Добавить колонку
          </button>
        </div>
      </div>
    </div>

    <div class="overlay" :class="{ 'is-open': cardOpen }" @click.self="cardOpen = false">
      <aside v-if="board.card" class="drawer">
        <div class="drawer-head">
          <div>
            <h2>{{ board.card.title }}</h2>
          </div>
          <button type="button" class="icon-btn" @click="cardOpen = false">×</button>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Исполнитель</label>
            <select
              class="select"
              :value="board.card.assigneeId ?? ''"
              :disabled="!canEdit"
              @change="board.patchCard(board.card.id, { assigneeId: ($event.target as HTMLSelectElement).value || null })"
            >
              <option value="">Без исполнителя</option>
              <option
                v-for="row in project.current?.rates ?? []"
                :key="row.userId"
                :value="row.userId"
              >
                {{ row.displayName }}
              </option>
            </select>
          </div>
          <div class="field">
            <label>Срок</label>
            <div class="fake-input">{{ formatDate(board.card.dueDate) }}</div>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Оценка, часы</label>
            <div class="fake-input">{{ board.card.estimateHours }}</div>
          </div>
          <div class="field">
            <label>План / факт</label>
            <div class="fake-input">
              {{ board.card.planAmount ?? '—' }} ₽
            </div>
          </div>
        </div>
        <div class="field">
          <label>Списания</label>
          <div v-for="entry in board.card.timeEntries" :key="entry.id" class="log-item">
            <div>{{ entry.displayName }} · {{ entry.hours }} ч</div>
            <div class="muted">{{ formatDate(entry.workedAt) }} · {{ entry.amount ?? '—' }} ₽</div>
          </div>
          <button v-if="canEdit" type="button" class="btn btn-ghost mt-8" @click="hoursOpen = true">
            Списать часы
          </button>
        </div>
        <div class="field">
          <label>Комментарии</label>
          <div v-for="item in board.card.comments" :key="item.id" class="comment">
            <div class="who">{{ item.displayName }}</div>
            <div>{{ item.body }}</div>
          </div>
          <input
            v-if="canEdit"
            v-model="comment"
            class="input mt-8"
            placeholder="Написать комментарий…"
            @keydown.enter="sendComment"
          >
        </div>
      </aside>
    </div>

    <ModalDialog :open="hoursOpen" title="Списать часы" @close="hoursOpen = false">
      <div class="field">
        <label>Часы</label>
        <input v-model.number="hours" class="input" type="number" min="0.5" step="0.5">
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" @click="hoursOpen = false">Отмена</button>
        <button type="button" class="btn" @click="logHours">Списать</button>
      </div>
    </ModalDialog>

    <ModalDialog :open="labelsOpen" title="Метки" @close="labelsOpen = false">
      <div v-for="label in board.current.labels" :key="label.id" class="label-row">
        <span :class="labelClass(label.color)">{{ label.name }}</span>
        <button type="button" class="btn btn-ghost" @click="board.deleteLabel(board.current!.id, label.id)">
          Удалить
        </button>
      </div>
      <div class="field-row mt-16">
        <div class="field">
          <label>Новая метка</label>
          <input v-model="labelName" class="input" type="text">
        </div>
        <div class="field">
          <label>Цвет</label>
          <select v-model="labelColor" class="select">
            <option value="blue">Синий</option>
            <option value="green">Зелёный</option>
            <option value="purple">Фиолетовый</option>
            <option value="pink">Розовый</option>
            <option value="amber">Янтарный</option>
          </select>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn" @click="saveLabels">Добавить метку</button>
      </div>
    </ModalDialog>
  </section>
</template>
