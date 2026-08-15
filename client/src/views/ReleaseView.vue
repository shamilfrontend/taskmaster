<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useBoardStore } from '../stores/board.ts';
import { http } from '../api/http.ts';
import { formatDate } from '../composables/format.ts';
import type { BoardCard } from '../types/index.ts';
import ModalDialog from '../components/ModalDialog.vue';

const route = useRoute();
const router = useRouter();
const board = useBoardStore();
const releaseId = computed(() => String(route.params.releaseId));
const attachOpen = ref(false);
const editOpen = ref(false);
const statusOpen = ref(false);
const deleteOpen = ref(false);
const selectedCardId = ref('');
const editName = ref('');
const editDate = ref('');
const projectCards = ref<BoardCard[]>([]);

onMounted(async () => {
  await board.fetchRelease(releaseId.value);

  if (board.release) {
    const { data } = await http.get<{
      board: { id: string };
    }>(`/projects/${board.release.projectId}`);
    const boardRes = await http.get<{ cards: BoardCard[] }>(
      `/boards/${data.board.id}`
    );
    projectCards.value = boardRes.data.cards;
  }
});

const canAdmin = computed(() => {
  const role = board.release?.role;
  return role === 'owner' || role === 'admin';
});

const canEdit = computed(() => {
  const role = board.release?.role;
  return role === 'owner' || role === 'admin' || role === 'member';
});

const availableCards = computed(() => {
  const attached = new Set(board.release?.cards.map((card) => card.id) ?? []);
  return projectCards.value.filter((card) => !attached.has(card.id));
});

function toDateInput(value: string | Date | null | undefined): string {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);

    if (match?.[1]) {
      return match[1];
    }
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function openEdit(): void {
  editName.value = board.release?.name ?? '';
  editDate.value = toDateInput(board.release?.date);
  editOpen.value = true;
}

async function saveEdit(): Promise<void> {
  const name = editName.value.trim();

  if (!name) {
    return;
  }

  const ok = await board.updateRelease(releaseId.value, {
    name,
    date: editDate.value || null
  });

  if (ok) {
    editOpen.value = false;
  }
}

async function markReleased(): Promise<void> {
  await board.setReleaseStatus(releaseId.value, 'released');
  statusOpen.value = false;
}

async function attach(): Promise<void> {
  await board.attachCard(releaseId.value, selectedCardId.value);
  selectedCardId.value = '';
  attachOpen.value = false;
}

async function detach(cardId: string): Promise<void> {
  await board.detachCard(releaseId.value, cardId);
}

async function remove(): Promise<void> {
  const projectId = board.release?.projectId;
  await board.deleteRelease(releaseId.value);
  deleteOpen.value = false;

  if (projectId) {
    await router.push({ name: 'project', params: { projectId } });
  }
}
</script>

<template>
  <section v-if="board.release" class="screen is-active">
    <div class="wrap">
      <div class="page-head">
        <div>
          <h1>
            {{ board.release.name }}
            <span
              class="badge"
              :class="board.release.status === 'released' ? 'badge-released' : 'badge-planned'"
            >
              {{ board.release.status }}
            </span>
          </h1>
          <p class="muted">
            {{ formatDate(board.release.date) || 'без даты' }}
          </p>
        </div>
        <div class="actions">
          <button
            v-if="canAdmin"
            type="button"
            class="btn btn-ghost"
            @click="openEdit"
          >
            Изменить
          </button>
          <button
            v-if="canEdit"
            type="button"
            class="btn"
            @click="attachOpen = true"
          >
            Прикрепить карточку
          </button>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head">
          <h2>Карточки релиза</h2>
          <button
            v-if="canAdmin && board.release.status !== 'released'"
            type="button"
            class="btn btn-ghost"
            @click="statusOpen = true"
          >
            Отметить как released
          </button>
        </div>
        <div v-for="card in board.release.cards" :key="card.id" class="list-row">
          <div class="grow">
            <div>{{ card.title }}</div>
            <div class="muted">{{ card.boardName }} · {{ card.columnName }}</div>
          </div>
          <span class="muted">{{ card.assigneeName }}</span>
          <button
            v-if="canEdit"
            type="button"
            class="btn btn-ghost"
            @click="detach(card.id)"
          >
            Открепить
          </button>
        </div>
        <div v-if="canAdmin" class="actions pt-12">
          <button type="button" class="btn btn-danger" @click="deleteOpen = true">
            Удалить
          </button>
        </div>
      </div>
    </div>

    <ModalDialog :open="editOpen" title="Изменить релиз" @close="editOpen = false">
      <p v-if="board.error" class="warn">{{ board.error }}</p>
      <div class="field">
        <label>Название</label>
        <input
          v-model="editName"
          class="input"
          type="text"
          placeholder="Название релиза…"
        >
      </div>
      <div class="field">
        <label>Дата релиза</label>
        <input v-model="editDate" class="input" type="date">
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" @click="editOpen = false">
          Отмена
        </button>
        <button
          type="button"
          class="btn"
          :disabled="!editName.trim()"
          @click="saveEdit"
        >
          Сохранить
        </button>
      </div>
    </ModalDialog>

    <ModalDialog :open="statusOpen" title="Статус релиза" @close="statusOpen = false">
      <p class="muted mb-16">Карточки не переместятся по колонкам.</p>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" @click="statusOpen = false">Отмена</button>
        <button type="button" class="btn" @click="markReleased">Отметить как released</button>
      </div>
    </ModalDialog>

    <ModalDialog :open="attachOpen" title="Прикрепить карточку" @close="attachOpen = false">
      <div class="choice-list">
        <p v-if="!availableCards.length" class="muted">Нет свободных карточек.</p>
        <label v-for="card in availableCards" :key="card.id" class="choice">
          <input v-model="selectedCardId" type="radio" :value="card.id">
          <span>{{ card.title }}</span>
        </label>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" @click="attachOpen = false">Отмена</button>
        <button type="button" class="btn" :disabled="!selectedCardId" @click="attach">Прикрепить</button>
      </div>
    </ModalDialog>

    <ModalDialog :open="deleteOpen" title="Удалить релиз" @close="deleteOpen = false">
      <p class="muted mb-16">Карточки останутся на доске без релиза.</p>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" @click="deleteOpen = false">Отмена</button>
        <button type="button" class="btn btn-danger" @click="remove">Удалить</button>
      </div>
    </ModalDialog>
  </section>
</template>
