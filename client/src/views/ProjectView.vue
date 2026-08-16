<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useBoardStore } from '../stores/board.ts';
import { useProjectStore } from '../stores/project.ts';
import {
  BOARD_BACKGROUNDS,
  boardBackgroundStyle,
  findBoardBackground
} from '../composables/board-backgrounds.ts';
import { useProjectTabs } from '../composables/project-tabs.ts';
import ModalDialog from '../components/ModalDialog.vue';
import PageTabs from '../components/PageTabs.vue';
import BoardView from './BoardView.vue';
import type { BoardBackgroundId, TeamRole } from '../types/index.ts';

const route = useRoute();
const router = useRouter();
const projects = useProjectStore();
const board = useBoardStore();
const projectId = computed(() => String(route.params.projectId));

const budgetOpen = ref(false);
const budgetLimit = ref('0');
const releaseOpen = ref(false);
const releaseName = ref('');
const releaseDate = ref('');
const ratesOpen = ref(false);
const deleteOpen = ref(false);
const releasesDraft = ref(false);
const budgetDraft = ref(false);
const roleRates = ref<Record<TeamRole, number>>({
  owner: 0,
  admin: 0,
  member: 0,
  viewer: 0
});

function syncFeatureDrafts(): void {
  releasesDraft.value = Boolean(projects.current?.releasesEnabled);
  budgetDraft.value = Boolean(projects.current?.budgetEnabled);
}

watch(projectId, async (id) => {
  if (projects.current?.id !== id) {
    projects.current = null;
    board.reset();
  }

  await projects.fetchOne(id);
  syncFeatureDrafts();

  if (projects.current?.roleRates) {
    roleRates.value = { ...projects.current.roleRates };
  }

  if (projects.current?.budgetLimit !== undefined) {
    budgetLimit.value = String(projects.current.budgetLimit);
  }
}, { immediate: true });

const canAdmin = computed(() => {
  const role = projects.current?.role;
  return role === 'owner' || role === 'admin';
});

const isReleases = computed(
  () =>
    route.query.tab === 'releases' &&
    Boolean(projects.current?.releasesEnabled)
);

const isSettings = computed(
  () => route.query.tab === 'settings' && canAdmin.value
);

const isBoard = computed(() => !isReleases.value && !isSettings.value);

const BACKGROUND_PREVIEW_COUNT = 12;
const showAllBackgrounds = ref(false);

const selectedBackground = computed(
  () => projects.current?.boardBackground ?? 'default'
);

const orderedBackgrounds = computed(() => {
  const selected = BOARD_BACKGROUNDS.find(
    (option) => option.id === selectedBackground.value
  );

  if (!selected) {
    return BOARD_BACKGROUNDS;
  }

  return [
    selected,
    ...BOARD_BACKGROUNDS.filter((option) => option.id !== selected.id)
  ];
});

const hasMoreBackgrounds = computed(
  () => orderedBackgrounds.value.length > BACKGROUND_PREVIEW_COUNT
);

const visibleBackgrounds = computed(() =>
  showAllBackgrounds.value
    ? orderedBackgrounds.value
    : orderedBackgrounds.value.slice(0, BACKGROUND_PREVIEW_COUNT)
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
  computed(() => projects.current?.role),
  computed(() => Boolean(projects.current?.releasesEnabled))
);

async function saveBudget(): Promise<void> {
  await projects.updateBudget(projectId.value, Number(budgetLimit.value));
  budgetOpen.value = false;
}

function openBudget(): void {
  budgetLimit.value = String(projects.current?.budgetLimit ?? 0);
  budgetOpen.value = true;
}

async function createRelease(): Promise<void> {
  const id = await projects.createRelease(
    projectId.value,
    releaseName.value,
    releaseDate.value || undefined
  );

  if (id) {
    releaseOpen.value = false;
    await router.push({ name: 'release', params: { releaseId: id } });
  }
}

async function saveRates(): Promise<void> {
  await projects.saveRoleRates(projectId.value, roleRates.value);
  ratesOpen.value = false;
}

async function saveFeatures(): Promise<void> {
  await projects.updateSettings(projectId.value, {
    releasesEnabled: releasesDraft.value,
    budgetEnabled: budgetDraft.value
  });
  syncFeatureDrafts();
}

async function selectBackground(id: BoardBackgroundId): Promise<void> {
  if (id === selectedBackground.value || projects.isLoading) {
    return;
  }

  if (projects.current) {
    projects.current.boardBackground = id;
  }

  await projects.updateSettings(projectId.value, { boardBackground: id });
}

async function removeProject(): Promise<void> {
  const teamId = projects.current?.teamId;
  const ok = await projects.deleteProject(projectId.value);

  if (ok && teamId) {
    await router.push({ name: 'team', params: { teamId } });
  }
}
</script>

<template>
  <section v-if="projects.current" class="screen is-active">
    <div
      class="board-screen"
      :class="{ 'has-photo': hasBoardPhoto }"
      :style="boardStyle"
    >
      <div class="page-head">
        <div>
          <h1>{{ projects.current.name }}</h1>
        </div>
      </div>
      <PageTabs :tabs="tabs" />
      <p v-if="projects.error" class="warn">{{ projects.error }}</p>
      <BoardView
        v-if="isBoard && projects.current.board.id"
        :key="projects.current.board.id"
      />
      <p v-else-if="isBoard" class="muted">Загрузка…</p>
      <div v-else-if="isReleases" class="stack">
        <div class="panel">
          <div class="panel-head">
            <h2>Релизы</h2>
            <button
              v-if="canAdmin"
              type="button"
              class="btn"
              @click="releaseOpen = true"
            >
              Создать релиз
            </button>
          </div>
          <button
            v-for="release in projects.current.releases"
            :key="release.id"
            type="button"
            class="list-row"
            @click="router.push({ name: 'release', params: { releaseId: release.id } })"
          >
            <div class="grow">
              <div>{{ release.name }}</div>
              <div class="muted">{{ release.cardCount }} карточки</div>
            </div>
            <span
              class="badge"
              :class="release.status === 'released' ? 'badge-released' : 'badge-planned'"
            >
              {{ release.status }}
            </span>
          </button>
        </div>
      </div>
      <div v-else-if="isSettings" class="stack">
        <div v-if="projects.current.budgetEnabled && projects.current.roleRates" class="panel">
          <div class="panel-head">
            <h2>Ставки, ₽/час</h2>
            <button type="button" class="btn btn-ghost" @click="ratesOpen = true">
              Ставки ролей
            </button>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Участник</th>
                <th>Источник</th>
                <th>Ставка</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in projects.current.rates" :key="row.userId">
                <td>{{ row.displayName }}</td>
                <td class="muted">
                  {{ row.source === 'personal' ? 'персональная' : 'роль ' + row.role }}
                </td>
                <td>{{ row.amount }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="panel">
          <div class="panel-head">
            <h2>Фон доски</h2>
          </div>
          <div class="bg-picker">
            <button
              v-for="option in visibleBackgrounds"
              :key="option.id"
              type="button"
              class="bg-pick"
              :class="{ 'is-on': option.id === selectedBackground }"
              :style="option.thumb ? { backgroundImage: `url(${option.thumb})` } : undefined"
              :title="option.label"
              :disabled="projects.isLoading"
              @click="selectBackground(option.id)"
            >
              <span>{{ option.label }}</span>
            </button>
          </div>
          <div v-if="hasMoreBackgrounds" class="actions actions--start mt-16">
            <button
              type="button"
              class="btn btn-ghost"
              @click="showAllBackgrounds = !showAllBackgrounds"
            >
              {{ showAllBackgrounds ? 'Свернуть' : 'Показать все' }}
            </button>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head">
            <h2>Функции</h2>
            <button
              v-if="projects.current.budgetEnabled && projects.current.role === 'owner'"
              type="button"
              class="btn btn-ghost"
              @click="openBudget"
            >
              Изменить бюджет
            </button>
          </div>
          <div class="choice-list">
            <label class="choice">
              <input v-model="releasesDraft" type="checkbox">
              <span>Релизы</span>
            </label>
            <label class="choice">
              <input v-model="budgetDraft" type="checkbox">
              <span>Введение бюджета</span>
            </label>
          </div>
          <div class="actions actions--start">
            <button
              type="button"
              class="btn"
              :disabled="projects.isLoading"
              @click="saveFeatures"
            >
              Сохранить
            </button>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head">
            <h2>Опасная зона</h2>
          </div>
          <div class="actions actions--start">
            <button type="button" class="btn btn-danger" @click="deleteOpen = true">
              Удалить проект
            </button>
          </div>
        </div>
      </div>
    </div>

    <ModalDialog :open="budgetOpen" title="Бюджет проекта" @close="budgetOpen = false">
      <div class="field">
        <label>Лимит, ₽</label>
        <input
          v-model="budgetLimit"
          class="input"
          type="number"
          min="0"
          placeholder="0"
        >
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" @click="budgetOpen = false">Отмена</button>
        <button type="button" class="btn" @click="saveBudget">Сохранить</button>
      </div>
    </ModalDialog>

    <ModalDialog :open="releaseOpen" title="Создать релиз" @close="releaseOpen = false">
      <div class="field">
        <label>Название</label>
        <input
          v-model="releaseName"
          class="input"
          type="text"
          placeholder="Название релиза…"
        >
      </div>
      <div class="field">
        <label>Дата релиза</label>
        <input v-model="releaseDate" class="input" type="date">
      </div>
      <p class="muted mb-16">При создании статус всегда planned.</p>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" @click="releaseOpen = false">Отмена</button>
        <button type="button" class="btn" @click="createRelease">Создать</button>
      </div>
    </ModalDialog>

    <ModalDialog :open="ratesOpen" title="Ставки ролей" @close="ratesOpen = false">
      <div v-for="role in (['owner', 'admin', 'member', 'viewer'] as TeamRole[])" :key="role" class="field">
        <label>{{ role }}</label>
        <input
          v-model.number="roleRates[role]"
          class="input"
          type="number"
          min="0"
          placeholder="0"
        >
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" @click="ratesOpen = false">Отмена</button>
        <button type="button" class="btn" @click="saveRates">Сохранить</button>
      </div>
    </ModalDialog>

    <ModalDialog :open="deleteOpen" title="Удалить проект" @close="deleteOpen = false">
      <p class="muted mb-16">Каскадом удалятся доски, карточки и релизы.</p>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" @click="deleteOpen = false">Отмена</button>
        <button type="button" class="btn btn-danger" @click="removeProject">Удалить</button>
      </div>
    </ModalDialog>
  </section>
</template>

<style lang="scss" scoped>
.bg-picker {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}

.bg-pick {
  position: relative;
  overflow: hidden;
  aspect-ratio: 16 / 10;
  border: 0;
  border-radius: var(--radius);
  background-color: var(--board-bg);
  background-size: cover;
  background-position: center;
  box-shadow: var(--shadow);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  text-align: left;

  &::after {
    content: "";
    position: absolute;
    inset: auto 0 0;
    height: 46%;
    background: linear-gradient(transparent, rgb(9 30 66 / 55%));
  }

  span {
    position: absolute;
    z-index: 1;
    right: 6px;
    bottom: 6px;
    left: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-shadow: 0 1px 2px #091e42a6;
  }

  &:hover:not(:disabled) {
    filter: brightness(1.08);
  }

  &.is-on {
    box-shadow: 0 0 0 2px var(--blue);
  }
}

@media (max-width: 800px) {
  .bg-picker {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
