<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useBoardStore } from '../stores/board.ts';
import { http } from '../api/http.ts';
import type { BoardCard } from '../types/index.ts';
import ModalDialog from '../components/ModalDialog.vue';

const route = useRoute();
const router = useRouter();
const board = useBoardStore();
const releaseId = computed(() => String(route.params.releaseId));
const attachOpen = ref(false);
const statusOpen = ref(false);
const deleteOpen = ref(false);
const selectedCardId = ref('');
const projectCards = ref<BoardCard[]>([]);

onMounted(async () => {
  await board.fetchRelease(releaseId.value);

  if (board.release) {
    const { data } = await http.get<{
      boards: { id: string }[];
    }>(`/projects/${board.release.projectId}`);
    const boards = await Promise.all(
      data.boards.map((item) => http.get<{ cards: BoardCard[] }>(`/boards/${item.id}`))
    );
    projectCards.value = boards.flatMap((item) => item.data.cards);
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

async function markReleased(): Promise<void> {
  await board.setReleaseStatus(releaseId.value, 'released');
  statusOpen.value = false;
}

async function attach(): Promise<void> {
  await board.attachCard(releaseId.value, selectedCardId.value);
  attachOpen.value = false;
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
        </div>
        <div class="actions">
          <button v-if="canAdmin" type="button" class="btn btn-ghost" @click="statusOpen = true">
            Отметить как released
          </button>
          <button v-if="canEdit" type="button" class="btn" @click="attachOpen = true">
            Прикрепить карточку
          </button>
          <button v-if="canAdmin" type="button" class="btn btn-danger" @click="deleteOpen = true">
            Удалить
          </button>
        </div>
      </div>
      <div class="panel">
        <h2>Карточки релиза</h2>
        <div v-for="card in board.release.cards" :key="card.id" class="project-row">
          <div class="grow">
            <div>{{ card.title }}</div>
            <div class="muted">{{ card.boardName }} · {{ card.columnName }}</div>
          </div>
          <span class="muted">{{ card.assigneeName }}</span>
        </div>
      </div>
    </div>

    <ModalDialog :open="statusOpen" title="Статус релиза" @close="statusOpen = false">
      <p class="muted mb-16">Карточки не переместятся по колонкам.</p>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" @click="statusOpen = false">Отмена</button>
        <button type="button" class="btn" @click="markReleased">Отметить как released</button>
      </div>
    </ModalDialog>

    <ModalDialog :open="attachOpen" title="Прикрепить карточку" @close="attachOpen = false">
      <div class="choice-list">
        <label v-for="card in projectCards" :key="card.id" class="choice">
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
      <p class="muted mb-16">Карточки останутся на досках без релиза.</p>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" @click="deleteOpen = false">Отмена</button>
        <button type="button" class="btn btn-danger" @click="remove">Удалить</button>
      </div>
    </ModalDialog>
  </section>
</template>
