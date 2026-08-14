<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';
import { useTeamsStore } from '../stores/teams.ts';
import {
  avatarClass,
  formatMoney,
  initials,
  roleClass
} from '../composables/format.ts';
import ModalDialog from '../components/ModalDialog.vue';
import type { InviteRole } from '../types/index.ts';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const teams = useTeamsStore();
const teamId = computed(() => String(route.params.teamId));

const inviteOpen = ref(false);
const inviteRole = ref<InviteRole>('member');
const inviteUrl = ref('');
const projectOpen = ref(false);
const projectName = ref('');
const projectBudget = ref('0');
const transferOpen = ref(false);
const transferUserId = ref('');
const deleteOpen = ref(false);
const deleteName = ref('');

onMounted(() => {
  void teams.fetchOne(teamId.value);
});

const canManage = computed(() => {
  const role = teams.current?.role;
  return role === 'owner' || role === 'admin';
});

async function createInvite(): Promise<void> {
  const token = await teams.createInvite(teamId.value, inviteRole.value);

  if (token) {
    inviteUrl.value = `${window.location.origin}/invite/${token}`;
  }
}

async function createProject(): Promise<void> {
  const budget =
    teams.current?.role === 'owner' ? Number(projectBudget.value) : undefined;
  const id = await teams.createProject(teamId.value, projectName.value, budget);

  if (id) {
    projectOpen.value = false;
    await router.push({ name: 'project', params: { projectId: id } });
  }
}

async function transfer(): Promise<void> {
  await teams.transferOwner(teamId.value, transferUserId.value);
  transferOpen.value = false;
}

async function removeTeam(): Promise<void> {
  const ok = await teams.deleteTeam(teamId.value, deleteName.value);

  if (ok) {
    await router.push({ name: 'teams' });
  }
}
</script>

<template>
  <section v-if="teams.current" class="screen is-active">
    <div class="wrap">
      <div class="page-head">
        <div>
          <h1>{{ teams.current.name }}</h1>
          <p>Участники, приглашения и проекты команды</p>
        </div>
        <button v-if="canManage" type="button" class="btn" @click="inviteOpen = true">
          Пригласить
        </button>
      </div>
      <p v-if="teams.error" class="warn">{{ teams.error }}</p>
      <div class="stack">
        <div class="panel">
          <h2>Участники</h2>
          <div
            v-for="member in teams.current.members"
            :key="member.userId"
            class="member-row"
          >
            <span :class="avatarClass(member.role)">{{ initials(member.displayName) }}</span>
            <div class="grow">
              <div>{{ member.displayName }}</div>
              <div class="muted">{{ member.email }}</div>
            </div>
            <span :class="roleClass(member.role)">{{ member.role }}</span>
          </div>
        </div>
        <div v-if="canManage" class="panel">
          <h2>Активные инвайты</h2>
          <div
            v-for="invite in teams.current.invites"
            :key="invite.id"
            class="invite-row"
          >
            <div class="grow">
              <div>Роль {{ invite.role }}</div>
            </div>
            <span class="muted">до {{ new Date(invite.expiresAt).toLocaleDateString('ru-RU') }}</span>
            <button
              type="button"
              class="btn btn-ghost"
              @click="teams.revokeInvite(teamId, invite.id)"
            >
              Отозвать
            </button>
          </div>
        </div>
        <div class="panel">
          <h2>Проекты</h2>
          <button
            v-for="project in teams.current.projects"
            :key="project.id"
            type="button"
            class="project-row row-btn"
            @click="router.push({ name: 'project', params: { projectId: project.id } })"
          >
            <div class="grow">
              <div>{{ project.name }}</div>
              <div class="muted">
                {{ project.budgetLimit !== undefined ? formatMoney(project.budgetLimit) : 'проект' }}
              </div>
            </div>
          </button>
          <div v-if="canManage" class="pt-12">
            <button type="button" class="btn btn-ghost" @click="projectOpen = true">
              Создать проект
            </button>
          </div>
        </div>
        <div v-if="teams.current.role === 'owner'" class="panel danger-zone">
          <h2>Настройки Owner</h2>
          <div class="actions">
            <button type="button" class="btn btn-ghost" @click="transferOpen = true">
              Передать Owner
            </button>
            <button type="button" class="btn btn-danger" @click="deleteOpen = true">
              Удалить команду
            </button>
          </div>
        </div>
      </div>
    </div>

    <ModalDialog :open="inviteOpen" title="Пригласить в команду" @close="inviteOpen = false">
      <template v-if="!inviteUrl">
        <div class="choice-list">
          <label class="choice">
            <input v-model="inviteRole" type="radio" value="admin">
            <span><strong>Admin</strong></span>
          </label>
          <label class="choice">
            <input v-model="inviteRole" type="radio" value="member">
            <span><strong>Member</strong></span>
          </label>
          <label class="choice">
            <input v-model="inviteRole" type="radio" value="viewer">
            <span><strong>Viewer</strong></span>
          </label>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" @click="inviteOpen = false">Отмена</button>
          <button type="button" class="btn" @click="createInvite">Создать ссылку</button>
        </div>
      </template>
      <template v-else>
        <div class="link-box">
          <input class="input" :value="inviteUrl" readonly>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn" @click="inviteOpen = false; inviteUrl = ''">Готово</button>
        </div>
      </template>
    </ModalDialog>

    <ModalDialog :open="projectOpen" title="Создать проект" @close="projectOpen = false">
      <div class="field">
        <label>Название</label>
        <input v-model="projectName" class="input" type="text">
      </div>
      <div v-if="teams.current.role === 'owner'" class="field">
        <label>Бюджет, ₽</label>
        <input v-model="projectBudget" class="input" type="number" min="0">
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" @click="projectOpen = false">Отмена</button>
        <button type="button" class="btn" @click="createProject">Создать</button>
      </div>
    </ModalDialog>

    <ModalDialog :open="transferOpen" title="Передать Owner" @close="transferOpen = false">
      <div class="choice-list">
        <label
          v-for="member in teams.current.members.filter((item) => item.userId !== auth.user?.id)"
          :key="member.userId"
          class="choice"
        >
          <input v-model="transferUserId" type="radio" :value="member.userId">
          <span>{{ member.displayName }} · {{ member.role }}</span>
        </label>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" @click="transferOpen = false">Отмена</button>
        <button type="button" class="btn" :disabled="!transferUserId" @click="transfer">Передать</button>
      </div>
    </ModalDialog>

    <ModalDialog :open="deleteOpen" title="Удалить команду" @close="deleteOpen = false">
      <p class="muted mb-16">Каскадом удалятся проекты и доски. Введите название.</p>
      <div class="field">
        <input v-model="deleteName" class="input" type="text">
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" @click="deleteOpen = false">Отмена</button>
        <button type="button" class="btn btn-danger" @click="removeTeam">Удалить</button>
      </div>
    </ModalDialog>
  </section>
</template>
