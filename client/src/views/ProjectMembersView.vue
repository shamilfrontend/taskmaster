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
import { useIosNavAction } from '../composables/ios-chrome.ts';
import ModalDialog from '../components/ModalDialog.vue';
import UserAvatar from '../components/UserAvatar.vue';
import type {
  InviteRole,
  ProjectInvite,
  ProjectMember,
  TeamRole,
} from '../types/index.ts';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const projects = useProjectStore();
const projectId = computed(() => String(route.params.projectId));

const addMemberOpen = ref(false);
const addMode = ref<'member' | 'link'>('member');
const addMemberUserId = ref('');
const addMemberRole = ref<InviteRole>('member');
const inviteRole = ref<InviteRole>('member');
const inviteUrl = ref('');
const inviteCopied = ref(false);
const memberActionOpen = ref(false);
const memberAction = ref<'remove' | 'leave'>('remove');
const memberTargetId = ref('');
const memberTargetName = ref('');
const revokeOpen = ref(false);
const revokeInviteId = ref('');
const revokeInviteRole = ref<InviteRole>('member');
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

useIosNavAction(() => (
  canManageMembers.value
    ? {
      id: 'add-member',
      label: '+',
      handler: () => {
        openAddMember();
      },
    }
    : null
));

const hasCandidates = computed(
  () => Boolean(projects.members?.candidates.length),
);

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
  inviteRole.value = 'member';
  inviteUrl.value = '';
  inviteCopied.value = false;
  addMode.value = hasCandidates.value ? 'member' : 'link';
  addMemberOpen.value = true;
}

function closeAddMember(): void {
  addMemberOpen.value = false;
  inviteUrl.value = '';
  inviteCopied.value = false;
}

function cancelInviteStep(): void {
  if (hasCandidates.value && addMode.value === 'link') {
    addMode.value = 'member';
    return;
  }

  closeAddMember();
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
    closeAddMember();
  }
}

async function createInvite(): Promise<void> {
  const token = await projects.createInvite(projectId.value, inviteRole.value);

  if (token) {
    inviteUrl.value = `${window.location.origin}/invite/${token}`;
    inviteCopied.value = false;
  }
}

async function copyInviteUrl(): Promise<void> {
  if (!inviteUrl.value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(inviteUrl.value);
    inviteCopied.value = true;
  } catch {
    inviteCopied.value = false;
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

function openRevoke(invite: ProjectInvite): void {
  revokeInviteId.value = invite.id;
  revokeInviteRole.value = invite.role;
  revokeOpen.value = true;
}

async function confirmRevoke(): Promise<void> {
  if (!revokeInviteId.value) {
    return;
  }

  const ok = await projects.revokeInvite(projectId.value, revokeInviteId.value);

  if (ok) {
    revokeOpen.value = false;
    revokeInviteId.value = '';
  }
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
    <div class="grouped-section">
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
      <div
        v-for="invite in projects.members?.invites ?? []"
        :key="invite.id"
        class="list-row"
      >
        <div class="grow">
          <div>Роль {{ roleLabel(invite.role) }}</div>
        </div>
        <span class="muted">
          до {{ new Date(invite.expiresAt).toLocaleDateString('ru-RU') }}
        </span>
        <button
          v-if="canManageMembers"
          type="button"
          class="btn btn-ghost"
          @click="openRevoke(invite)"
        >
          Отозвать
        </button>
      </div>
      <p
        v-if="!projects.members?.members.length && !projects.members?.invites.length"
        class="muted"
      >
        Нет участников
      </p>
    </div>
  </div>

  <ModalDialog
    :open="addMemberOpen"
    title="Добавить участника"
    @close="closeAddMember"
  >
    <template v-if="!inviteUrl">
      <template v-if="hasCandidates && addMode === 'member'">
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
            @click="closeAddMember"
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
        <p class="muted mt-16 tight">
          <button
            type="button"
            class="btn btn-ghost"
            @click="addMode = 'link'"
          >
            Пригласить по ссылке
          </button>
        </p>
      </template>
      <template v-else>
        <div class="choice-list">
          <label class="choice">
            <input
              v-model="inviteRole"
              type="radio"
              value="admin"
            >
            <span><strong>{{ roleLabel('admin') }}</strong></span>
          </label>
          <label class="choice">
            <input
              v-model="inviteRole"
              type="radio"
              value="member"
            >
            <span><strong>{{ roleLabel('member') }}</strong></span>
          </label>
          <label class="choice">
            <input
              v-model="inviteRole"
              type="radio"
              value="viewer"
            >
            <span><strong>{{ roleLabel('viewer') }}</strong></span>
          </label>
        </div>
        <div class="modal-foot">
          <button
            type="button"
            class="btn btn-ghost"
            @click="cancelInviteStep"
          >
            {{ hasCandidates && addMode === 'link' ? 'Назад' : 'Отмена' }}
          </button>
          <button
            type="button"
            class="btn"
            @click="createInvite"
          >
            Создать ссылку
          </button>
        </div>
      </template>
    </template>
    <template v-else>
      <div class="link-box">
        <input
          class="input"
          :value="inviteUrl"
          readonly
        >
      </div>
      <div class="modal-foot">
        <button
          type="button"
          class="btn btn-ghost"
          @click="copyInviteUrl"
        >
          {{ inviteCopied ? 'Скопировано' : 'Копировать' }}
        </button>
        <button
          type="button"
          class="btn"
          @click="closeAddMember"
        >
          Готово
        </button>
      </div>
    </template>
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

  <ModalDialog
    :open="revokeOpen"
    title="Отозвать приглашение"
    @close="revokeOpen = false"
  >
    <p class="muted mb-16">
      Ссылка с ролью {{ roleLabel(revokeInviteRole) }} перестанет работать.
    </p>
    <div class="modal-foot">
      <button
        type="button"
        class="btn btn-ghost"
        @click="revokeOpen = false"
      >
        Отмена
      </button>
      <button
        type="button"
        class="btn btn-danger"
        @click="confirmRevoke"
      >
        Отозвать
      </button>
    </div>
  </ModalDialog>
</template>

<style lang="scss" scoped>
.link-box {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;

  .input {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
  }
}
</style>
