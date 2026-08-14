<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useBoardStore } from '../stores/board.ts';
import { useProjectStore } from '../stores/project.ts';
import {
  formatDate,
  initials,
  labelClass
} from '../composables/format.ts';
import ModalDialog from '../components/ModalDialog.vue';
import type { LabelColor } from '../types/index.ts';

const route = useRoute();
const board = useBoardStore();
const project = useProjectStore();
const boardId = computed(() => String(route.params.boardId));
const cardOpen = ref(false);
const createOpen = ref(false);
const hoursOpen = ref(false);
const labelsOpen = ref(false);
const title = ref('');
const columnId = ref('');
const assigneeId = ref('');
const dueDate = ref('');
const estimateHours = ref(0);
const releaseId = ref('');
const hours = ref(2);
const comment = ref('');
const labelName = ref('');
const labelColor = ref<LabelColor>('blue');
const columnName = ref('');

onMounted(async () => {
  await board.fetchBoard(boardId.value);

  if (board.current) {
    await project.fetchOne(board.current.projectId);
    columnId.value = board.current.columns[0]?.id ?? '';
  }
});

const canEdit = computed(() => {
  const role = board.current?.role;
  return role === 'owner' || role === 'admin' || role === 'member';
});

const canAdmin = computed(() => {
  const role = board.current?.role;
  return role === 'owner' || role === 'admin';
});

function cardsOf(id: string) {
  return (board.current?.cards ?? [])
    .filter((card) => card.columnId === id)
    .slice()
    .sort((a, b) => a.position - b.position);
}

async function openCard(id: string): Promise<void> {
  await board.fetchCard(id);
  cardOpen.value = true;
}

async function createCard(): Promise<void> {
  await board.createCard({
    boardId: boardId.value,
    columnId: columnId.value,
    title: title.value,
    assigneeId: assigneeId.value || undefined,
    dueDate: dueDate.value || undefined,
    estimateHours: estimateHours.value,
    releaseId: releaseId.value || undefined
  });
  createOpen.value = false;
}

async function onDrop(event: DragEvent, targetColumnId: string): Promise<void> {
  const cardId = event.dataTransfer?.getData('text/plain');

  if (!cardId || !canEdit.value) {
    return;
  }

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

async function addCol(): Promise<void> {
  if (!board.current) {
    return;
  }

  await board.addColumn(board.current.id, columnName.value);
  columnName.value = '';
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
          <button v-if="canEdit" type="button" class="btn" @click="createOpen = true">
            Добавить карточку
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
          <div class="column-head">
            <h2>{{ column.name }}</h2>
            <span class="count">{{ cardsOf(column.id).length }}</span>
          </div>
          <button
            v-for="card in cardsOf(column.id)"
            :key="card.id"
            type="button"
            class="task"
            draggable="true"
            @dragstart="($event as DragEvent).dataTransfer?.setData('text/plain', card.id)"
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

    <ModalDialog :open="createOpen" title="Новая карточка" @close="createOpen = false">
      <div class="field">
        <label>Название</label>
        <input v-model="title" class="input" type="text">
      </div>
      <div class="field-row">
        <div class="field">
          <label>Колонка</label>
          <select v-model="columnId" class="select">
            <option v-for="column in board.current.columns" :key="column.id" :value="column.id">
              {{ column.name }}
            </option>
          </select>
        </div>
        <div class="field">
          <label>Исполнитель</label>
          <select v-model="assigneeId" class="select">
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
      </div>
      <div class="field-row">
        <div class="field">
          <label>Срок</label>
          <input v-model="dueDate" class="input" type="date">
        </div>
        <div class="field">
          <label>Оценка, часы</label>
          <input v-model.number="estimateHours" class="input" type="number" min="0" step="0.5">
        </div>
      </div>
      <div class="field">
        <label>Релиз</label>
        <select v-model="releaseId" class="select">
          <option value="">Без релиза</option>
          <option v-for="item in board.current.releases" :key="item.id" :value="item.id">
            {{ item.name }}
          </option>
        </select>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" @click="createOpen = false">Отмена</button>
        <button type="button" class="btn" @click="createCard">Создать</button>
      </div>
    </ModalDialog>

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

    <ModalDialog :open="labelsOpen" title="Метки и колонки" @close="labelsOpen = false">
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
      <div class="field mt-16">
        <label>Новая колонка</label>
        <input v-model="columnName" class="input" type="text">
      </div>
      <div class="modal-foot">
        <button type="button" class="btn" @click="addCol">Добавить колонку</button>
      </div>
    </ModalDialog>
  </section>
</template>
