<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { safeAuthNext, useAuthStore } from '../stores/auth.ts';

interface LandingCard {
  title: string;
  text: string;
}

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const next = computed(() => safeAuthNext(route.query.next));

const pains: LandingCard[] = [
  {
    title: 'Нет общей доски',
    text: 'Задачи в чатах, сроки в таблицах, статусы в голове. Нужно одно место, куда можно привести команду.',
  },
  {
    title: 'Неясно, кто что делает',
    text: 'Сроки в голове, статусы в сообщениях. Горит ли задача — видно только если спросить.',
  },
  {
    title: 'Сложно подключить людей',
    text: 'Заказчику нужна доска без права всё править. Коллеге — свои карточки, без долгой настройки.',
  },
];

const outcomes: LandingCard[] = [
  {
    title: 'Проект - это доска',
    text: 'Колонки и карточки с drag-and-drop. Исполнитель, срок, чеклист, комментарии. Фильтры по человеку, метке и статусу.',
  },
  {
    title: 'Команда в одном месте',
    text: 'Добавляйте участников, раздавайте роли.',
  },
  {
    title: 'Аналитика рядом',
    text: 'Если понадобится — включите в настройках: статусы, загрузка и релизы. Не мешают, пока ведёте обычные задачи.',
  },
];

function login(): void {
  auth.login(next.value);
}

async function loginDemo(): Promise<void> {
  const ok = await auth.loginDemo();

  if (ok) {
    await router.push(next.value);
  }
}
</script>

<template>
  <div class="landing">
    <header class="landing-bar">
      <div class="landing-bar__inner">
        <div class="brand">
          <img
            src="/logo/kanban.svg"
            alt=""
          >
          <span class="brand__name">TaskMaster</span>
        </div>
        <div class="landing-actions">
          <button
            type="button"
            class="btn btn-yandex"
            @click="login"
          >
            <span class="ya-mark">Я</span>
            Войти<span class="label-tail"> через Яндекс ID</span>
          </button>
        </div>
      </div>
    </header>

    <p
      v-if="auth.error"
      class="warn landing-error"
    >
      {{ auth.error }}
    </p>

    <section class="hero">
      <div class="hero__inner">
        <div class="hero__copy">
          <h1>Управляйте проектами и задачами без лишнего</h1>
          <p class="hero__lead">
            Команды, проекты, задачи. <br>
            Аналитика по статусам и загрузке. <br>
            Есть импорт проекта из Trello.
          </p>
          <div class="hero__actions">
            <button
              type="button"
              class="btn btn-hero"
              @click="login"
            >
              <span class="ya-mark">Я</span>
              Открыть доску
            </button>
            <button
              type="button"
              class="btn btn-demo btn-demo-on-dark"
              :disabled="auth.isLoading"
              @click="loginDemo"
            >
              {{ auth.isLoading ? 'Открываем…' : 'Демо-доступ' }}
            </button>
          </div>
        </div>
        <figure class="hero__shot">
          <img
            src="/board-preview.jpg"
            alt="Доска проекта в Taskmaster: колонки, карточки, фильтры и вкладки"
          >
        </figure>
      </div>
    </section>

    <section class="wrap block">
      <div class="section-head">
        <h2>Знакомо?</h2>
      </div>
      <div class="cards">
        <article
          v-for="item in pains"
          :key="item.title"
          class="panel"
        >
          <h3>{{ item.title }}</h3>
          <p class="muted">
            {{ item.text }}
          </p>
        </article>
      </div>
    </section>

    <section class="wrap block">
      <div class="section-head">
        <h2>Что меняется с Taskmaster</h2>
      </div>
      <div class="cards">
        <article
          v-for="item in outcomes"
          :key="item.title"
          class="panel"
        >
          <h3>{{ item.title }}</h3>
          <p class="muted">
            {{ item.text }}
          </p>
        </article>
      </div>
    </section>

    <section class="cta">
      <div class="wrap">
        <h2>Откройте доску, которая работает из России</h2>
        <p>
          Войдите через Яндекс ID и начните с задач.
          В настройках проектов можно включить релизы и аналитику.
        </p>
        <div class="cta__actions">
          <button
            type="button"
            class="btn btn-hero"
            @click="login"
          >
            <span class="ya-mark">Я</span>
            Войти через Яндекс ID
          </button>
          <button
            type="button"
            class="btn btn-demo btn-demo-on-dark"
            :disabled="auth.isLoading"
            @click="loginDemo"
          >
            {{ auth.isLoading ? 'Открываем…' : 'Демо-доступ' }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.landing {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--bg);
}

.landing-error {
  width: min(1120px, calc(100% - 48px));
  margin: 12px auto 0;
}

.landing-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 12px 24px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.landing-bar__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: min(1120px, 100%);
  margin: 0 auto;
}

.landing-actions,
.hero__actions,
.cta__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.hero__actions,
.cta__actions {
  gap: 12px;
}

.cta__actions {
  justify-content: center;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-weight: 600;
  font-size: 14px;
  color: var(--text);

  img {
    flex-shrink: 0;
    width: 34px;
    height: 34px;
    border-radius: 6px;
  }
}

.brand__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-yandex,
.btn-hero {
  width: auto;
  padding: 0 16px;
}

.landing-bar .btn-yandex {
  flex-shrink: 0;
  height: 40px;
  padding: 0 14px;
  white-space: nowrap;
}

.btn-demo {
  width: auto;
  padding: 0 16px;
  background: transparent;
  border-color: var(--border);
  color: var(--text);

  &:hover:not(:disabled) {
    background: var(--hover);
  }
}

.btn-demo-on-dark {
  height: 44px;
  border-color: rgb(255 255 255 / 55%);
  color: #fff;

  &:hover:not(:disabled) {
    background: rgb(255 255 255 / 12%);
  }
}

.btn-hero {
  height: 44px;
  background: #fff;
  color: var(--text);

  &:hover:not(:disabled) {
    background: #f4f5f7;
  }
}

.hero {
  background: var(--board-bg);
  color: #fff;
  padding: 56px 24px 48px;
  overflow: hidden;
}

.hero__inner {
  display: grid;
  grid-template-columns: minmax(280px, 0.85fr) minmax(0, 1.15fr);
  gap: 40px;
  align-items: center;
  width: min(1120px, 100%);
  margin: 0 auto;
}

.hero__copy {
  padding: 0;
}

.hero__copy h1 {
  margin: 0 0 16px;
  max-width: 18ch;
  font-size: 40px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
}

.hero__lead {
  margin: 0 0 24px;
  max-width: 42ch;
  color: rgb(255 255 255 / 88%);
  font-size: 17px;
  line-height: 1.45;
}

.hero__shot {
  margin: 0;
  min-width: 0;
  line-height: 0;

  img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: var(--radius-lg);
    box-shadow: 0 16px 40px #00000059;
  }
}

.block {
  padding-top: 48px;
  padding-bottom: 8px;
}

.section-head {
  margin-bottom: 20px;

  h2 {
    margin: 0 0 8px;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  p {
    margin: 0;
    max-width: 52ch;
  }
}

.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;

  h3 {
    margin: 0 0 8px;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  p {
    margin: 0;
  }
}

.cta {
  margin-top: 48px;
  padding: 56px 0 64px;
  background: var(--board-bg);
  color: #fff;
  text-align: center;

  h2 {
    margin: 0 0 10px;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  p {
    margin: 0 auto 24px;
    max-width: 44ch;
    color: rgb(255 255 255 / 82%);
  }
}

@media (max-width: 1024px) {
  .hero__inner {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 24px;
  }

  .hero__copy h1 {
    font-size: 32px;
  }
}

@media (max-width: 800px) {
  .landing-bar {
    padding: 10px 16px;
  }

  .hero {
    padding: 36px 16px 32px;
  }

  .hero__inner {
    grid-template-columns: 1fr;
    gap: 28px;
  }

  .hero__copy h1 {
    max-width: none;
    font-size: 28px;
  }

  .cards {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 600px) {
  .landing-error {
    width: min(1120px, calc(100% - 32px));
  }

  .landing-bar .btn-yandex {
    padding: 0 12px;
  }

  .brand {
    font-size: 13px;
  }

  .hero {
    padding: 28px 16px;
  }

  .hero__copy h1 {
    font-size: 26px;
  }

  .hero__lead {
    font-size: 15px;

    br {
      display: none;
    }
  }

  .hero__shot {
    margin: 0 -16px;

    img {
      border-radius: 0;
      box-shadow: none;
    }
  }

  .hero__actions,
  .cta__actions {
    flex-direction: column;
    align-items: stretch;

    .btn {
      width: 100%;
    }
  }

  .block {
    padding-top: 32px;
  }

  .section-head h2,
  .cta h2 {
    font-size: 20px;
  }

  .cards {
    grid-template-columns: 1fr;
  }

  .cta {
    margin-top: 32px;
    padding: 40px 0 48px;
  }
}

/* На самых узких экранах полная подпись кнопки вытесняет логотип. */
@media (max-width: 380px) {
  .label-tail {
    display: none;
  }
}
</style>
