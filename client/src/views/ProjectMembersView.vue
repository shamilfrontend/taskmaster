<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';
import { useProjectStore } from '../stores/project.ts';
import {
  avatarClass,
  roleClass,
  roleLabel,
} from '../composables/format.ts';
import ModalDialog from '../components/ModalDialog.vue';
import UserAvatar from '../components/UserAvatar.vue';
import type {
  InviteRole,
  ProjectMember,
  TeamRole,
} from '../types/index.ts';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const projects = useProjectStore();
const projectId = computed(() => String(route.params.projectId));

const addMemberOpen = ref(false);
const addMemberUserId = ref('');
const addMemberRole = ref<InviteRole>('member');
const memberActionOpen = ref(false);
const memberAction = ref<'remove' | 'leave'>('remove');
const memberTargetId = ref('');
const memberTargetName = ref('');
const assignableRoles: InviteRole[] = ['admin', 'member', 'viewer'];

watch(
  projectId,
  (id) => {
    void projects.fetchMembers(id);
  },
  { immediate: true },
);

const canManageMembers = computed(() => {
  const role = projects.current?.role;
  const teamRole = projects.current?.teamRole;
  return role === 'owner' || role === 'admin' || teamRole === 'owner';
});

function canManageMember(targetRole: TeamRole): boolean {
  const actor = projects.current?.teamRole === 'owner'
    ? 'owner'
    : projects.current?.role;

  if (actor === 'owner') {
    return targetRole !== 'owner';
  }

  if (actor === 'admin') {
    return targetRole === 'member' || targetRole === 'viewer';
  }

  return false;
}

function isSelf(userId: string): boolean {
  return userId === auth.user?.id;
}

const canLeave = computed(() => {
  const self = projects.members?.members.find(
    (item) => item.userId === auth.user?.id,
  );
  return Boolean(self && self.role !== 'owner');
});

function openAddMember(): void {
  addMemberUserId.value = projects.members?.candidates[0]?.userId ?? '';
  addMemberRole.value = 'member';
  addMemberOpen.value = true;
}

async function submitAddMember(): Promise<void> {
  if (!addMemberUserId.value) {
    return;
  }

  const ok = await projects.addMember(
    projectId.value,
    addMemberUserId.value,
    addMemberRole.value,
  );

  if (ok) {
    addMemberOpen.value = false;
  }
}

async function onRoleChange(userId: string, event: Event): Promise<void> {
  const select = event.target as HTMLSelectElement;
  const role = select.value as InviteRole;
  const ok = await projects.changeMemberRole(projectId.value, userId, role);

  if (!ok) {
    const member = projects.members?.members.find((item) => item.userId === userId);
    select.value = member?.role ?? select.value;
  }
}

function openRemove(member: ProjectMember): void {
  memberAction.value = 'remove';
  memberTargetId.value = member.userId;
  memberTargetName.value = member.displayName;
  memberActionOpen.value = true;
}

function openLeave(): void {
  memberAction.value = 'leave';
  memberTargetId.value = auth.user?.id ?? '';
  memberTargetName.value = '';
  memberActionOpen.value = true;
}

async function confirmMemberAction(): Promise<void> {
  if (!memberTargetId.value) {
    return;
  }

  const teamId = projects.current?.teamId;
  const ok = await projects.removeMember(projectId.value, memberTargetId.value);

  if (!ok) {
    return;
  }

  memberActionOpen.value = false;

  if (memberAction.value === 'leave' && teamId) {
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
        <h2>Участники проекта</h2>
        <button
          v-if="canManageMembers"
          type="button"
          class="btn"
          :disabled="!projects.members?.candidates.length"
          @click="openAddMember"
        >
          Добавить
        </button>
      </div>
      <div
        v-for="member in projects.members?.members ?? []"
        :key="member.userId"
        class="list-row"
      >
        <UserAvatar
          :class="avatarClass(member.role)"
          :name="member.displayName"
          :src="member.avatarUrl"
        />
        <div class="grow">
          <div>{{ member.displayName }}</div>
          <div class="muted">
            {{ member.email }}
          </div>
        </div>
        <template v-if="canManageMember(member.role)">
          <select
            class="select select-inline"
            :value="member.role"
            @change="onRoleChange(member.userId, $event)"
          >
            <option
              v-for="role in assignableRoles"
              :key="role"
              :value="role"
            >
              {{ roleLabel(role) }}
            </option>
          </select>
          <div class="row-actions">
            <button
              type="button"
              class="btn btn-ghost"
              @click="openRemove(member)"
            >
              Исключить
            </button>
          </div>
        </template>
        <template v-else>
          <span :class="roleClass(member.role)">{{ roleLabel(member.role) }}</span>
          <button
            v-if="isSelf(member.userId) && canLeave"
            type="button"
            class="btn btn-ghost"
            @click="openLeave"
          >
            Выйти
          </button>
        </template>
      </div>
      <p
        v-if="!projects.members?.members.length"
        class="muted"
      >
        Нет участников
      </p>
    </div>
  </div>

  <ModalDialog
    :open="addMemberOpen"
    title="Добавить участника"
    @close="addMemberOpen = false"
  >
    <div class="field">
      <label>Участник команды</label>
      <select
        v-model="addMemberUserId"
        class="select"
      >
        <option
          v-for="candidate in projects.members?.candidates ?? []"
          :key="candidate.userId"
          :value="candidate.userId"
        >
          {{ candidate.displayName }}
        </option>
      </select>
    </div>
    <div class="field">
      <label>Роль на проекте</label>
      <select
        v-model="addMemberRole"
        class="select"
      >
        <option
          v-for="role in assignableRoles"
          :key="role"
          :value="role"
        >
          {{ roleLabel(role) }}
        </option>
      </select>
    </div>
    <div class="modal-foot">
      <button
        type="button"
        class="btn btn-ghost"
        @click="addMemberOpen = false"
      >
        Отмена
      </button>
      <button
        type="button"
        class="btn"
        :disabled="!addMemberUserId"
        @click="submitAddMember"
      >
        Добавить
      </button>
    </div>
  </ModalDialog>

  <ModalDialog
    :open="memberActionOpen"
    :title="memberAction === 'leave' ? 'Выйти из проекта' : 'Исключить участника'"
    @close="memberActionOpen = false"
  >
    <p class="muted mb-16">
      <template v-if="memberAction === 'leave'">
        Вы потеряете доступ к проекту.
      </template>
      <template v-else>
        «{{ memberTargetName }}» потеряет доступ к проекту.
      </template>
    </p>
    <div class="modal-foot">
      <button
        type="button"
        class="btn btn-ghost"
        @click="memberActionOpen = false"
      >
        Отмена
      </button>
      <button
        type="button"
        class="btn btn-danger"
        @click="confirmMemberAction"
      >
        {{ memberAction === 'leave' ? 'Выйти' : 'Исключить' }}
      </button>
    </div>
  </ModalDialog>
</template>
