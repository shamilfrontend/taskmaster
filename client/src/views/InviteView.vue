<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';
import { http, errorMessage } from '../api/http.ts';
import type { InvitePreview, InviteRole } from '../types/index.ts';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const preview = ref<InvitePreview | null>(null);
const error = ref<string | null>(null);
const token = computed(() => String(route.params.token ?? ''));

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
    const { data } = await http.post<{ teamId: string }>(
      `/invites/${token.value}/accept`
    );
    await router.push({ name: 'team', params: { teamId: data.teamId } });
  } catch (err: unknown) {
    error.value = errorMessage(err);
  }
}

function login(): void {
  auth.login(`/invite/${token.value}`);
}

const roleLabel = (role: InviteRole): string => role;
</script>

<template>
  <section class="screen screen--center is-active">
    <div class="card auth-card">
      <img src="/logo/kanban.svg" alt="Taskmaster">
      <h1>Приглашение в команду</h1>
      <p v-if="error">{{ error }}</p>
      <template v-else-if="preview">
        <p>
          Вас пригласили в {{ preview.teamName }}.
          Для вступления нужен вход через Яндекс ID.
        </p>
        <div class="invite-meta">
          <span>Команда</span>
          <strong>{{ preview.teamName }}</strong>
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
        <button v-else type="button" class="btn" @click="accept">Вступить</button>
        <p class="muted mt-16 tight">Ссылка одноразовая, срок 7 дней</p>
      </template>
    </div>
  </section>
</template>
