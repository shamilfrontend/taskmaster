<script setup lang="ts">
import {
  computed, onMounted, onUnmounted, ref, watch,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';
import { useProjectStore } from '../stores/project.ts';
import { useTeamsStore } from '../stores/teams.ts';
import {
  avatarClass,
  formatDate,
  formatMoney,
  initials,
  roleClass,
  roleLabel,
} from '../composables/format.ts';
import ModalDialog from '../components/ModalDialog.vue';
import PageTabs, { type PageTab } from '../components/PageTabs.vue';
import type {
  ActivityItem,
  ActivityKind,
  InviteRole,
  TeamInvite,
  TeamMember,
  TeamRole,
} from '../types/index.ts';

interface MenuPosition {
  top: string;
  right: string;
}

type ProjectSource = 'blank' | 'trello';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const teams = useTeamsStore();
const projects = useProjectStore();
const teamId = computed(() => String(route.params.teamId));

const inviteOpen = ref(false);
const inviteRole = ref<InviteRole>('member');
const inviteUrl = ref('');
const inviteCopied = ref(false);
const projectOpen = ref(false);
const projectName = ref('');
const projectSource = ref<ProjectSource>('blank');
const trelloBoard = ref<unknown>(null);
const trelloError = ref('');
const trelloInputKey = ref(0);
const deleteOpen = ref(false);
const projectDeleteOpen = ref(false);
const projectToDelete = ref<{ id: string; name: string } | null>(null);
const menuProjectId = ref<string | null>(null);
const menuPosition = ref<MenuPosition | null>(null);
const memberActionOpen = ref(false);
const memberAction = ref<'remove' | 'leave'>('remove');
const memberTargetId = ref('');
const memberTargetName = ref('');
const revokeOpen = ref(false);
const revokeInviteId = ref('');
const revokeInviteRole = ref<InviteRole>('member');
const teamNameDraft = ref('');
const assignableRoles: InviteRole[] = ['admin', 'member', 'viewer'];

onMounted(() => {
  document.addEventListener('click', closeMenus);
  window.addEventListener('scroll', closeMenus, true);
  window.addEventListener('resize', closeMenus);
});

onUnmounted(() => {
  document.removeEventListener('click', closeMenus);
  window.removeEventListener('scroll', closeMenus, true);
  window.removeEventListener('resize', closeMenus);
});

watch(teamId, async (id) => {
  if (teams.current?.id !== id) {
    teams.current = null;
  }

  teams.activity = [];
  teams.activityHasMore = false;
  closeMenus();
  await teams.fetchOne(id);

  if (teams.current) {
    teamNameDraft.value = teams.current.name;
  }
}, { immediate: true });

const canManage = computed(() => {
  const role = teams.current?.role;
  return role === 'owner' || role === 'admin';
});

const isOwner = computed(() => teams.current?.role === 'owner');

const canSaveName = computed(() => {
  const draft = teamNameDraft.value.trim();
  return Boolean(draft) && draft !== teams.current?.name;
});

const menuProject = computed(() => {
  if (!menuProjectId.value || !teams.current) {
    return null;
  }

  return teams.current.projects.find((item) => item.id === menuProjectId.value)
    ?? null;
});

type TeamTab = 'projects' | 'members' | 'activity' | 'settings';

const activeTab = computed<TeamTab>(() => {
  const { tab } = route.query;

  if (tab === 'members') {
    return 'members';
  }

  if (tab === 'activity') {
    return 'activity';
  }

  if (tab === 'settings' && canManage.value) {
    return 'settings';
  }

  return 'projects';
});

watch(
  [teamId, activeTab],
  async ([id, tab]) => {
    if (tab === 'activity' && id) {
      await teams.fetchActivity(id);
    }
  },
  { immediate: true },
);

const tabs = computed<PageTab[]>(() => {
  const items: PageTab[] = [
    {
      id: 'projects',
      label: 'Проекты',
      to: { name: 'team', params: { teamId: teamId.value } },
    },
    {
      id: 'members',
      label: 'Участники',
      to: {
        name: 'team',
        params: { teamId: teamId.value },
        query: { tab: 'members' },
      },
    },
    {
      id: 'activity',
      label: 'Действия',
      to: {
        name: 'team',
        params: { teamId: teamId.value },
        query: { tab: 'activity' },
      },
    },
  ];

  if (canManage.value) {
    items.push({
      id: 'settings',
      label: 'Настройки',
      to: {
        name: 'team',
        params: { teamId: teamId.value },
        query: { tab: 'settings' },
      },
    });
  }

  return items;
});

function closeMenus(): void {
  menuProjectId.value = null;
  menuPosition.value = null;
}

function placeMenu(event: MouseEvent): MenuPosition | null {
  const button = event.currentTarget;

  if (!(button instanceof HTMLElement)) {
    return null;
  }

  const rect = button.getBoundingClientRect();

  return {
    top: `${Math.round(rect.bottom + 4)}px`,
    right: `${Math.round(window.innerWidth - rect.right)}px`,
  };
}

function toggleProjectMenu(event: MouseEvent, projectId: string): void {
  if (menuProjectId.value === projectId) {
    closeMenus();
    return;
  }

  const position = placeMenu(event);

  if (!position) {
    return;
  }

  menuProjectId.value = projectId;
  menuPosition.value = position;
}

function openProject(projectId: string): void {
  void router.push({ name: 'project', params: { projectId } });
}

async function duplicateProject(): Promise<void> {
  if (!menuProject.value) {
    return;
  }

  const projectId = menuProject.value.id;
  closeMenus();
  const id = await projects.duplicateProject(projectId);

  if (id) {
    await teams.fetchOne(teamId.value);
  }
}

function openProjectDelete(): void {
  if (!menuProject.value) {
    return;
  }

  projectToDelete.value = {
    id: menuProject.value.id,
    name: menuProject.value.name,
  };
  projectDeleteOpen.value = true;
  closeMenus();
}

async function confirmProjectDelete(): Promise<void> {
  if (!projectToDelete.value) {
    return;
  }

  const ok = await projects.deleteProject(projectToDelete.value.id);

  if (ok) {
    projectDeleteOpen.value = false;
    projectToDelete.value = null;
    await teams.fetchOne(teamId.value);
  }
}

function closeInviteModal(): void {
  inviteOpen.value = false;
  inviteUrl.value = '';
  inviteCopied.value = false;
  inviteRole.value = 'member';
}

async function createInvite(): Promise<void> {
  const token = await teams.createInvite(teamId.value, inviteRole.value);

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

function isTrelloBoard(value: unknown): value is { name: string } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    typeof row.name === 'string'
    && Array.isArray(row.lists)
    && Array.isArray(row.cards)
  );
}

function resetTrelloFile(): void {
  trelloBoard.value = null;
  trelloError.value = '';
  trelloInputKey.value += 1;
}

function openProjectModal(): void {
  projectName.value = '';
  projectSource.value = 'blank';
  resetTrelloFile();
  projectOpen.value = true;
}

function closeProjectModal(): void {
  projectOpen.value = false;
  projectName.value = '';
  projectSource.value = 'blank';
  resetTrelloFile();
}

watch(projectSource, (source) => {
  if (source === 'blank') {
    resetTrelloFile();
  }
});

function onTrelloFile(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  trelloError.value = '';
  trelloBoard.value = null;

  if (!file) {
    return;
  }

  void file.text().then((text) => {
    try {
      const parsed: unknown = JSON.parse(text);

      if (!isTrelloBoard(parsed)) {
        trelloError.value = 'Это не экспорт доски Trello';
        return;
      }

      trelloBoard.value = parsed;
      projectName.value = parsed.name;
    } catch {
      trelloError.value = 'Не удалось прочитать JSON';
    }
  });
}

async function createProject(): Promise<void> {
  if (projectSource.value === 'trello' && !trelloBoard.value) {
    trelloError.value = 'Выберите JSON-файл Trello';
    return;
  }

  const id = projectSource.value === 'trello' && trelloBoard.value
    ? await teams.createProjectFromTrello(
      teamId.value,
      projectName.value,
      trelloBoard.value,
    )
    : await teams.createProject(teamId.value, projectName.value);

  if (id) {
    closeProjectModal();
    await router.push({ name: 'project', params: { projectId: id } });
  }
}

async function saveTeamName(): Promise<void> {
  const name = teamNameDraft.value.trim();

  if (!name || name === teams.current?.name) {
    return;
  }

  const ok = await teams.renameTeam(teamId.value, name);

  if (ok && teams.current) {
    teamNameDraft.value = teams.current.name;
  }
}

async function removeTeam(): Promise<void> {
  const ok = await teams.deleteTeam(teamId.value);

  if (ok) {
    await router.push({ name: 'teams' });
  }
}

function canManageMember(targetRole: TeamRole): boolean {
  const actor = teams.current?.role;

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

function activityAction(kind: ActivityKind): string {
  if (kind === 'card_created') {
    return 'создал карточку';
  }

  if (kind === 'card_moved') {
    return 'переместил карточку';
  }

  return 'прокомментировал';
}

function activitySubtitle(item: ActivityItem): string {
  if (item.kind === 'card_moved' && item.detail) {
    return `${item.cardTitle} → ${item.detail}`;
  }

  if (item.kind === 'comment_added' && item.detail) {
    return `${item.cardTitle}: ${item.detail}`;
  }

  return item.cardTitle;
}

function openActivityItem(item: ActivityItem): void {
  void router.push({
    name: 'project',
    params: { projectId: item.projectId },
    query: { card: item.cardId },
  });
}

function loadMoreActivity(): void {
  void teams.fetchActivity(teamId.value, false);
}

const canLeave = computed(() => {
  const role = teams.current?.role;
  return role === 'admin' || role === 'member' || role === 'viewer';
});

async function onRoleChange(userId: string, event: Event): Promise<void> {
  const select = event.target as HTMLSelectElement;
  const role = select.value as InviteRole;
  const ok = await teams.changeRole(teamId.value, userId, role);

  if (!ok) {
    const member = teams.current?.members.find((item) => item.userId === userId);
    select.value = member?.role ?? select.value;
  }
}

function openRemove(member: TeamMember): void {
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

  if (memberAction.value === 'leave') {
    const ok = await teams.removeMember(
      teamId.value,
      memberTargetId.value,
      false,
    );

    if (ok) {
      memberActionOpen.value = false;
      await router.push({ name: 'teams' });
    }

    return;
  }

  const ok = await teams.removeMember(teamId.value, memberTargetId.value);

  if (ok) {
    memberActionOpen.value = false;
  }
}

function openRevoke(invite: TeamInvite): void {
  revokeInviteId.value = invite.id;
  revokeInviteRole.value = invite.role;
  revokeOpen.value = true;
}

async function confirmRevoke(): Promise<void> {
  if (!revokeInviteId.value) {
    return;
  }

  const ok = await teams.revokeInvite(teamId.value, revokeInviteId.value);

  if (ok) {
    revokeOpen.value = false;
    revokeInviteId.value = '';
  }
}
</script>

<template>
  <section class="screen is-active">
    <div class="wrap">
      <p
        v-if="teams.isLoading && !teams.current"
        class="muted"
      >
        Загрузка…
      </p>
      <template v-else-if="!teams.current">
        <p
          v-if="teams.error"
          class="warn"
        >
          {{ teams.error }}
        </p>
        <p
          v-else
          class="muted"
        >
          Команда не найдена
        </p>
      </template>
      <template v-else>
        <div class="page-head">
          <div>
            <h1>{{ teams.current.name }}</h1>
            <p>Участники и проекты команды</p>
          </div>
        </div>
        <PageTabs :tabs="tabs" />
        <p
          v-if="teams.error"
          class="warn"
        >
          {{ teams.error }}
        </p>
        <div
          v-if="activeTab === 'projects'"
          class="stack"
        >
          <div class="panel">
            <div class="panel-head">
              <h2>Проекты</h2>
              <button
                v-if="canManage"
                type="button"
                class="btn"
                @click="openProjectModal"
              >
                Создать проект
              </button>
            </div>
            <template v-if="teams.current.projects.length">
              <div
                v-for="project in teams.current.projects"
                :key="project.id"
                class="list-row"
                role="button"
                tabindex="0"
                @click="openProject(project.id)"
                @keydown.enter.prevent="openProject(project.id)"
              >
                <span class="avatar">{{ initials(project.name) }}</span>
                <div class="grow">
                  {{ project.name }}
                </div>
                <span
                  v-if="project.budgetEnabled && project.budgetLimit !== undefined"
                  class="muted"
                >
                  {{ formatMoney(project.budgetLimit) }}
                </span>
                <button
                  v-if="canManage"
                  type="button"
                  class="column-menu-btn"
                  aria-label="Действия с проектом"
                  @click.stop="toggleProjectMenu($event, project.id)"
                >
                  ⋯
                </button>
              </div>
            </template>
            <p
              v-else
              class="muted"
            >
              Нет проектов
            </p>
          </div>
        </div>
        <div
          v-else-if="activeTab === 'members'"
          class="stack"
        >
          <div class="panel">
            <div class="panel-head">
              <h2>Участники</h2>
              <button
                v-if="canManage"
                type="button"
                class="btn"
                @click="inviteOpen = true"
              >
                Добавить участника
              </button>
            </div>
            <div
              v-for="member in teams.current.members"
              :key="member.userId"
              class="list-row"
            >
              <span :class="avatarClass(member.role)">{{ initials(member.displayName) }}</span>
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
              v-for="invite in teams.current.invites"
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
                v-if="canManage"
                type="button"
                class="btn btn-ghost"
                @click="openRevoke(invite)"
              >
                Отозвать
              </button>
            </div>
          </div>
        </div>
        <div
          v-else-if="activeTab === 'activity'"
          class="stack"
        >
          <div class="panel">
            <div class="panel-head">
              <h2>Действия</h2>
            </div>
            <p
              v-if="teams.isActivityLoading && !teams.activity.length"
              class="muted"
            >
              Загрузка…
            </p>
            <template v-else>
              <button
                v-for="item in teams.activity"
                :key="item.id"
                type="button"
                class="list-row"
                @click="openActivityItem(item)"
              >
                <div class="grow">
                  <div>
                    {{ item.actorName || 'Участник' }}
                    {{ activityAction(item.kind) }}
                  </div>
                  <div class="muted">
                    {{ activitySubtitle(item) }}
                  </div>
                </div>
                <span class="muted">{{ formatDate(item.createdAt) }}</span>
              </button>
              <p
                v-if="!teams.activity.length"
                class="muted"
              >
                Нет активности
              </p>
              <div
                v-if="teams.activityHasMore"
                class="actions actions--start mt-16"
              >
                <button
                  type="button"
                  class="btn btn-ghost"
                  :disabled="teams.isActivityLoading"
                  @click="loadMoreActivity"
                >
                  Загрузить еще
                </button>
              </div>
            </template>
          </div>
        </div>
        <div
          v-else-if="activeTab === 'settings'"
          class="stack"
        >
          <div class="panel">
            <div class="panel-head">
              <h2>Общие</h2>
            </div>
            <div class="field">
              <label>Название команды</label>
              <input
                v-model="teamNameDraft"
                class="input"
                type="text"
                placeholder="Название команды…"
              >
            </div>
            <div class="actions actions--start">
              <button
                type="button"
                class="btn"
                :disabled="!canSaveName || teams.isLoading"
                @click="saveTeamName"
              >
                Сохранить
              </button>
            </div>
          </div>
          <div
            v-if="isOwner"
            class="panel"
          >
            <div class="panel-head">
              <h2>Опасная зона</h2>
            </div>
            <div class="actions actions--start">
              <button
                type="button"
                class="btn btn-danger"
                @click="deleteOpen = true"
              >
                Удалить команду
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <ModalDialog
      v-if="teams.current"
      :open="inviteOpen"
      title="Добавить участника"
      @close="closeInviteModal"
    >
      <template v-if="!inviteUrl">
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
            @click="closeInviteModal"
          >
            Отмена
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
            @click="closeInviteModal"
          >
            Готово
          </button>
        </div>
      </template>
    </ModalDialog>

    <ModalDialog
      v-if="teams.current"
      :open="projectOpen"
      title="Создать проект"
      @close="closeProjectModal"
    >
      <div class="choice-list choice-list--row">
        <label class="choice">
          <input
            v-model="projectSource"
            type="radio"
            value="blank"
          >
          <span><strong>Обычный</strong></span>
        </label>
        <label class="choice">
          <input
            v-model="projectSource"
            type="radio"
            value="trello"
          >
          <span><strong>Из Trello</strong></span>
        </label>
      </div>
      <div class="field">
        <label>Название</label>
        <input
          v-model="projectName"
          class="input"
          type="text"
          placeholder="Название проекта…"
        >
      </div>
      <div
        v-if="projectSource === 'trello'"
        class="field"
      >
        <p class="muted mb-16">
          В Trello откройте доску → меню → Печать, экспорт
          и публикация → Экспортировать как JSON.
        </p>
        <label>Файл Trello</label>
        <input
          :key="trelloInputKey"
          class="input"
          type="file"
          accept=".json,application/json"
          @change="onTrelloFile"
        >
      </div>
      <p
        v-if="trelloError || teams.error"
        class="warn"
      >
        {{ trelloError || teams.error }}
      </p>
      <div class="modal-foot">
        <button
          type="button"
          class="btn btn-ghost"
          @click="closeProjectModal"
        >
          Отмена
        </button>
        <button
          type="button"
          class="btn"
          :disabled="teams.isLoading"
          @click="createProject"
        >
          Создать
        </button>
      </div>
    </ModalDialog>

    <ModalDialog
      :open="memberActionOpen"
      :title="memberAction === 'leave' ? 'Выйти из команды' : 'Исключить участника'"
      @close="memberActionOpen = false"
    >
      <p class="muted mb-16">
        <template v-if="memberAction === 'leave'">
          Вы потеряете доступ к проектам команды.
        </template>
        <template v-else>
          {{ memberTargetName }} будет исключён. Карточки останутся без исполнителя.
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

    <Teleport to="body">
      <div
        v-if="menuProject && menuPosition"
        class="column-menu"
        :style="menuPosition"
        @click.stop
      >
        <button
          type="button"
          @click="duplicateProject"
        >
          Дублировать
        </button>
        <button
          type="button"
          class="is-danger"
          @click="openProjectDelete"
        >
          Удалить
        </button>
      </div>
    </Teleport>

    <ModalDialog
      :open="projectDeleteOpen"
      title="Удалить проект"
      @close="projectDeleteOpen = false"
    >
      <p class="muted mb-16">
        «{{ projectToDelete?.name }}» будет удалён. Каскадом удалятся доски,
        карточки и релизы.
      </p>
      <div class="modal-foot">
        <button
          type="button"
          class="btn btn-ghost"
          @click="projectDeleteOpen = false"
        >
          Отмена
        </button>
        <button
          type="button"
          class="btn btn-danger"
          @click="confirmProjectDelete"
        >
          Удалить
        </button>
      </div>
    </ModalDialog>

    <ModalDialog
      :open="deleteOpen"
      title="Удалить команду"
      @close="deleteOpen = false"
    >
      <p class="muted mb-16">
        Каскадом удалятся проекты и доски.
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
          @click="removeTeam"
        >
          Удалить
        </button>
      </div>
    </ModalDialog>
  </section>
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
