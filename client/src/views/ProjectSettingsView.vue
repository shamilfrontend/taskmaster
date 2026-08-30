<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '../stores/project.ts';
import { BOARD_BACKGROUNDS } from '../composables/board-backgrounds.ts';
import ModalDialog from '../components/ModalDialog.vue';
import type { BoardBackgroundId } from '../types/index.ts';

const route = useRoute();
const router = useRouter();
const projects = useProjectStore();
const projectId = computed(() => String(route.params.projectId));

const deleteOpen = ref(false);
const releasesDraft = ref(false);
const analyticsDraft = ref(false);
const projectNameDraft = ref('');

function syncFeatureDrafts(): void {
  releasesDraft.value = Boolean(projects.current?.releasesEnabled);
  analyticsDraft.value = Boolean(projects.current?.analyticsEnabled);
}

function syncProjectNameDraft(): void {
  projectNameDraft.value = projects.current?.name ?? '';
}

watch(
  () => projects.current,
  (project) => {
    if (!project) {
      return;
    }

    syncFeatureDrafts();
    syncProjectNameDraft();
  },
  { immediate: true },
);

const canSaveProjectName = computed(() => {
  const draft = projectNameDraft.value.trim();
  return Boolean(draft) && draft !== projects.current?.name;
});

const BACKGROUND_PREVIEW_COUNT = 12;
const showAllBackgrounds = ref(false);

const selectedBackground = computed(
  () => projects.current?.boardBackground ?? 'default',
);

const orderedBackgrounds = computed(() => {
  const selected = BOARD_BACKGROUNDS.find(
    (option) => option.id === selectedBackground.value,
  );

  if (!selected) {
    return BOARD_BACKGROUNDS;
  }

  return [
    selected,
    ...BOARD_BACKGROUNDS.filter((option) => option.id !== selected.id),
  ];
});

const hasMoreBackgrounds = computed(
  () => orderedBackgrounds.value.length > BACKGROUND_PREVIEW_COUNT,
);

const visibleBackgrounds = computed(() => (showAllBackgrounds.value
  ? orderedBackgrounds.value
  : orderedBackgrounds.value.slice(0, BACKGROUND_PREVIEW_COUNT)));

async function saveProjectName(): Promise<void> {
  const name = projectNameDraft.value.trim();

  if (!name || name === projects.current?.name) {
    return;
  }

  const ok = await projects.renameProject(projectId.value, name);

  if (ok) {
    projectNameDraft.value = projects.current?.name ?? name;
  }
}

async function saveFeatures(): Promise<void> {
  await projects.updateSettings(projectId.value, {
    releasesEnabled: releasesDraft.value,
    analyticsEnabled: analyticsDraft.value,
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

async function exportProject(): Promise<void> {
  await projects.exportProject(projectId.value, projects.current?.name);
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
  <div
    v-if="projects.current"
    class="stack"
  >
    <div class="panel">
      <div class="panel-head">
        <h2>Общие</h2>
      </div>
      <div class="field">
        <label>Название проекта</label>
        <input
          v-model="projectNameDraft"
          class="input"
          type="text"
          placeholder="Название проекта…"
        >
      </div>
      <div class="actions actions--start">
        <button
          type="button"
          class="btn"
          :disabled="!canSaveProjectName || projects.isLoading"
          @click="saveProjectName"
        >
          Сохранить
        </button>
      </div>
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
      <div
        v-if="hasMoreBackgrounds"
        class="actions actions--start mt-16"
      >
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
      </div>
      <div class="choice-list">
        <label class="choice">
          <input
            v-model="releasesDraft"
            type="checkbox"
          >
          <span>Релизы</span>
        </label>
        <label class="choice">
          <input
            v-model="analyticsDraft"
            type="checkbox"
          >
          <span>Аналитика</span>
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
        <h2>Экспорт</h2>
      </div>
      <p class="muted mb-16">
        Скачивается JSON с доской, карточками, релизами, комментариями
        и списаниями. Состав проекта в файл не входит.
      </p>
      <div class="actions actions--start">
        <button
          type="button"
          class="btn"
          :disabled="projects.isLoading"
          @click="exportProject"
        >
          Скачать файл
        </button>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head">
        <h2>Опасная зона</h2>
      </div>
      <div class="actions actions--start">
        <button
          type="button"
          class="btn btn-danger"
          @click="deleteOpen = true"
        >
          Удалить проект
        </button>
      </div>
    </div>
  </div>

  <ModalDialog
    :open="deleteOpen"
    title="Удалить проект"
    @close="deleteOpen = false"
  >
    <p class="muted mb-16">
      Каскадом удалятся доски, карточки и релизы.
    </p>
    <div class="modal-foot">
      <button
        type="button"
        class="btn btn-ghost"
        @click="deleteOpen = false"
      >
        Отмена
      </button>
      <button
        type="button"
        class="btn btn-danger"
        @click="removeProject"
      >
        Удалить
      </button>
    </div>
  </ModalDialog>
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
