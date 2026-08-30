<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';
import { useProjectStore } from '../stores/project.ts';
import { BOARD_BACKGROUNDS } from '../composables/board-backgrounds.ts';
import {
  avatarClass,
  roleClass,
  roleLabel,
} from '../composables/format.ts';
import ModalDialog from '../components/ModalDialog.vue';
import UserAvatar from '../components/UserAvatar.vue';
import type {
  BoardBackgroundId,
  InviteRole,
  ProjectMember,
  TeamRole,
} from '../types/index.ts';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const projects = useProjectStore();
const projectId = computed(() => String(route.params.projectId));

const deleteOpen = ref(false);
const addMemberOpen = ref(false);
const addMemberUserId = ref('');
const addMemberRole = ref<InviteRole>('member');
const memberActionOpen = ref(false);
const memberAction = ref<'remove' | 'leave'>('remove');
const memberTargetId = ref('');
const memberTargetName = ref('');
const releasesDraft = ref(false);
const projectNameDraft = ref('');
const assignableRoles: InviteRole[] = ['admin', 'member', 'viewer'];

function syncFeatureDrafts(): void {
  releasesDraft.value = Boolean(projects.current?.releasesEnabled);
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
