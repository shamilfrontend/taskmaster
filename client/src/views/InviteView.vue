<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';
import { http, errorMessage } from '../api/http.ts';
import { roleLabel } from '../composables/format.ts';
import type { InvitePreview } from '../types/index.ts';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const preview = ref<InvitePreview | null>(null);
const error = ref<string | null>(null);
const token = computed(() => String(route.params.token ?? ''));
const isProjectInvite = computed(() => Boolean(preview.value?.projectName));

onMounted(async () => {
  try {
    const { data } = await http.get<InvitePreview>(`/invites/${token.value}`);
    preview.value = data;

    if (auth.user) {
      await accept();
    }
  } catch (err: unknown) {
    error.value = errorMessage(err);
  }
});

async function accept(): Promise<void> {
  try {
    const { data } = await http.post<{
      teamId: string;
      projectId?: string;
    }>(
      `/invites/${token.value}/accept`,
    );

    if (data.projectId) {
      await router.push({
        name: 'project',
        params: { projectId: data.projectId },
      });
      return;
    }

    await router.push({ name: 'team', params: { teamId: data.teamId } });
  } catch (err: unknown) {
    error.value = errorMessage(err);
  }
}

function login(): void {
  auth.login(`/invite/${token.value}`);
}
</script>

<template>
  <section class="screen screen--center is-active">
    <div class="card auth-card">
      <img
        src="/logo/kanban.svg"
        alt="Taskmaster"
      >
      <h1>
        {{ isProjectInvite ? 'Приглашение в проект' : 'Приглашение в команду' }}
      </h1>
      <p v-if="error">
        {{ error }}
      </p>
      <template v-else-if="preview">
        <p v-if="preview.projectName">
          Вас пригласили в проект {{ preview.projectName }}
          команды {{ preview.teamName }}.
          Для вступления нужен вход через Яндекс ID.
        </p>
        <p v-else>
          Вас пригласили в {{ preview.teamName }}.
          Для вступления нужен вход через Яндекс ID.
        </p>
        <div class="invite-meta">
          <span>Команда</span>
          <strong>{{ preview.teamName }}</strong>
        </div>
        <div
          v-if="preview.projectName"
          class="invite-meta"
        >
          <span>Проект</span>
          <strong>{{ preview.projectName }}</strong>
        </div>
        <div class="invite-meta">
          <span>Роль</span>
          <strong>{{ roleLabel(preview.role) }}</strong>
        </div>
        <button
          v-if="!auth.user"
          type="button"
          class="btn btn-yandex"
          @click="login"
        >
          <span class="ya-mark">Я</span>
          Войти и вступить
        </button>
        <button
          v-else
          type="button"
          class="btn"
          @click="accept"
        >
          Вступить
        </button>
        <p class="muted mt-16 tight">
          Ссылка одноразовая, срок 7 дней
        </p>
      </template>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.auth-card {
  width: 400px;
  padding: 40px 32px;
  text-align: center;
  box-shadow: 0 8px 24px #091e4226;

  img {
    width: 48px;
    height: 48px;
  }

  h1 {
    margin: 16px 0 8px;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  p {
    margin: 0 0 24px;
    color: var(--muted);
    font-size: 14px;
  }
}

.invite-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--input-bg);
  text-align: left;
  font-size: 14px;
}
</style>
