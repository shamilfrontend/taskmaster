<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useTeamsStore } from '../stores/teams.ts';
import { initials } from '../composables/format.ts';
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
        <button type="button" class="btn" @click="modalOpen = true">
          Создать команду
        </button>
      </div>
      <p v-if="teams.error" class="warn">{{ teams.error }}</p>
      <div class="team-grid">
        <button
          v-for="team in teams.list"
          :key="team.id"
          type="button"
          class="team-card"
          @click="router.push({ name: 'team', params: { teamId: team.id } })"
        >
          <span class="avatar lg">{{ initials(team.name) }}</span>
          <h3>{{ team.name }}</h3>
          <div class="meta">
            <span>{{ team.memberCount }} участника</span>
            <span>{{ team.projectCount }} проекта</span>
          </div>
        </button>
        <button type="button" class="team-card create" @click="modalOpen = true">
          + Новая команда
        </button>
      </div>
    </div>
    <ModalDialog :open="modalOpen" title="Создать команду" @close="modalOpen = false">
      <div class="field">
        <label for="team-name">Название</label>
        <input id="team-name" v-model="name" class="input" type="text">
      </div>
      <p class="muted mb-16">Вы станете Owner этой команды.</p>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" @click="modalOpen = false">Отмена</button>
        <button type="button" class="btn" :disabled="!name.trim() || teams.isLoading" @click="create">
          Создать
        </button>
      </div>
    </ModalDialog>
  </section>
</template>
