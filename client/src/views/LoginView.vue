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
</style>
