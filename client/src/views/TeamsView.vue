<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useTeamsStore } from '../stores/teams.ts';
import {
  avatarClass,
  initials,
  pluralRu,
  roleClass,
  roleLabel,
} from '../composables/format.ts';
import ModalDialog from '../components/ModalDialog.vue';

const router = useRouter();
const teams = useTeamsStore();
const modalOpen = ref(false);
const name = ref('');

onMounted(() => {
  void teams.fetchList();
});

async function create(): Promise<void> {
  const id = await teams.createTeam(name.value);

  if (id) {
    modalOpen.value = false;
    name.value = '';
    await router.push({ name: 'team', params: { teamId: id } });
  }
}
</script>

<template>
  <section class="screen is-active">
    <div class="wrap">
      <div class="page-head">
        <div>
          <h1>Команды</h1>
          <p>Рабочие пространства, в которых вы состоите</p>
        </div>
        <button
          type="button"
          class="btn"
          @click="modalOpen = true"
        >
          Создать команду
        </button>
      </div>
      <p
        v-if="teams.error"
        class="warn"
      >
        {{ teams.error }}
      </p>
      <p
        v-if="teams.isLoading && !teams.list.length"
        class="muted"
      >
        Загрузка…
      </p>
      <div
        v-else-if="!teams.isLoading && !teams.list.length"
        class="panel empty-panel"
      >
        <h2>Пока нет команд</h2>
        <p class="muted">
          Создайте рабочее пространство или дождитесь приглашения.
        </p>
        <button
          type="button"
          class="btn"
          @click="modalOpen = true"
        >
          Создать команду
        </button>
      </div>
      <div
        v-else
        class="panel"
      >
        <button
          v-for="team in teams.list"
          :key="team.id"
          type="button"
          class="list-row"
          @click="router.push({ name: 'team', params: { teamId: team.id } })"
        >
          <span :class="avatarClass(team.role)">{{ initials(team.name) }}</span>
          <div class="grow">
            <div>{{ team.name }}</div>
            <div class="muted">
              {{
                pluralRu(
                  team.memberCount,
                  'участник',
                  'участника',
                  'участников'
                )
              }}
              ·
              {{ pluralRu(team.projectCount, 'проект', 'проекта', 'проектов') }}
            </div>
          </div>
          <span :class="roleClass(team.role)">{{ roleLabel(team.role) }}</span>
        </button>
      </div>
    </div>
    <ModalDialog
      :open="modalOpen"
      title="Создать команду"
      @close="modalOpen = false"
    >
      <div class="field">
        <label for="team-name">Название</label>
        <input
          id="team-name"
          v-model="name"
          class="input"
          type="text"
          placeholder="Название команды…"
        >
      </div>
      <p class="muted mb-16">
        Вы станете владельцем этой команды.
      </p>
      <div class="modal-foot">
        <button
          type="button"
          class="btn btn-ghost"
          @click="modalOpen = false"
        >
          Отмена
        </button>
        <button
          type="button"
          class="btn"
          :disabled="!name.trim() || teams.isLoading"
          @click="create"
        >
          Создать
        </button>
      </div>
    </ModalDialog>
  </section>
</template>
