<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '../stores/project.ts';
import ModalDialog from '../components/ModalDialog.vue';

const route = useRoute();
const router = useRouter();
const projects = useProjectStore();
const projectId = computed(() => String(route.params.projectId));

const releaseOpen = ref(false);
const releaseName = ref('');
const releaseDate = ref('');

const canAdmin = computed(() => {
  const role = projects.current?.role;
  return role === 'owner' || role === 'admin';
});

function openRelease(releaseId: string): void {
  void router.push({
    name: 'release',
    params: { projectId: projectId.value, releaseId },
  });
}

async function createRelease(): Promise<void> {
  const id = await projects.createRelease(
    projectId.value,
    releaseName.value,
    releaseDate.value || undefined,
  );

  if (id) {
    releaseOpen.value = false;
    await router.push({
      name: 'release',
      params: { projectId: projectId.value, releaseId: id },
    });
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
        @click="openRelease(release.id)"
      >
        <div class="grow">
          <div>{{ release.name }}</div>
          <div class="muted">
            {{ release.cardCount }} карточки
          </div>
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

  <ModalDialog
    :open="releaseOpen"
    title="Создать релиз"
    @close="releaseOpen = false"
  >
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
      <input
        v-model="releaseDate"
        class="input"
        type="date"
      >
    </div>
    <p class="muted mb-16">
      При создании статус всегда planned.
    </p>
    <div class="modal-foot">
      <button
        type="button"
        class="btn btn-ghost"
        @click="releaseOpen = false"
      >
        Отмена
      </button>
      <button
        type="button"
        class="btn"
        @click="createRelease"
      >
        Создать
      </button>
    </div>
  </ModalDialog>
</template>
