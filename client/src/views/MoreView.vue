<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';
import { PRODUCT_LINKS } from '../composables/products.ts';
import UserAvatar from '../components/UserAvatar.vue';

const router = useRouter();
const auth = useAuthStore();

const currentHost = computed(() => window.location.hostname);

function isCurrent(host: string): boolean {
  return host === currentHost.value;
}

async function logout(): Promise<void> {
  await auth.logout();
  await router.push({ name: 'landing' });
}
</script>

<template>
  <section class="screen is-active">
    <div class="wrap">
      <div
        v-if="auth.user"
        class="grouped"
      >
        <p class="grouped-caption">
          Профиль
        </p>
        <div class="grouped-section">
          <div class="list-row">
            <UserAvatar
              :name="auth.user.displayName"
              :src="auth.user.avatarUrl"
            />
            <div class="grow">
              <div>{{ auth.user.displayName }}</div>
              <div class="muted">
                {{ auth.user.email }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="grouped">
        <p class="grouped-caption">
          Продукты
        </p>
        <div class="grouped-section">
          <a
            v-for="product in PRODUCT_LINKS"
            :key="product.id"
            class="list-row has-disclosure"
            :class="{ 'is-selected': isCurrent(product.host) }"
            :href="product.href"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span
              class="product-icon"
              :style="{ background: product.iconBg }"
            >
              <img
                v-if="product.iconSrc"
                :src="product.iconSrc"
                alt=""
              >
              <span v-else>{{ product.initial }}</span>
            </span>
            <div class="grow">
              {{ product.name }}
            </div>
          </a>
        </div>
      </div>

      <div class="grouped">
        <div class="grouped-section">
          <button
            type="button"
            class="list-row list-row--danger"
            @click="logout"
          >
            <div class="grow">
              Выйти
            </div>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.product-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 29px;
  height: 29px;
  flex-shrink: 0;
  border-radius: 6px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 4%), 0 1px 1px rgb(0 0 0 / 25%);
  color: #fff;
  font-size: 12px;
  font-weight: 700;

  img {
    width: 18px;
    height: 18px;
    border-radius: 3px;
    background: #fff;
  }
}
</style>
