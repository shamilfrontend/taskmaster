<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';

const auth = useAuthStore();
const route = useRoute();
const next = ref('/');

onMounted(() => {
  next.value = typeof route.query.next === 'string' ? route.query.next : '/';
});
</script>

<template>
  <section class="screen screen--center is-active">
    <div class="card auth-card">
      <img src="/logo/kanban.svg" alt="Taskmaster">
      <h1>Taskmaster</h1>
      <p>Доски, бюджет и аналитика для команды. Вход только через Яндекс ID.</p>
      <button type="button" class="btn btn-yandex" @click="auth.login(next)">
        <span class="ya-mark">Я</span>
        Войти через Яндекс ID
      </button>
    </div>
  </section>
</template>
