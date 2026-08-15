<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

interface ProductLink {
  id: string;
  name: string;
  href: string;
  host: string;
  initial: string;
  iconSrc?: string;
  iconBg: string;
}

const products: ProductLink[] = [
  {
    id: 'taskmaster',
    name: 'TaskMaster',
    href: 'https://taskmaster.shamilfrontend.ru',
    host: 'taskmaster.shamilfrontend.ru',
    initial: 'T',
    iconSrc: '/logo/kanban.svg',
    iconBg: '#0079bf'
  },
  {
    id: 'roundtalk',
    name: 'RoundTalk',
    href: 'https://roundtalk.shamilfrontend.ru',
    host: 'roundtalk.shamilfrontend.ru',
    initial: 'R',
    iconBg: '#61bd4f'
  },
  {
    id: 'mockapi',
    name: 'MockApi',
    href: 'https://mockapi.shamilfrontend.ru',
    host: 'mockapi.shamilfrontend.ru',
    initial: 'M',
    iconBg: '#c377e0'
  }
];

const isOpen = ref(false);
const rootRef = ref<HTMLElement | null>(null);

const currentHost = computed(() => window.location.hostname);

function isCurrent(product: ProductLink): boolean {
  return product.host === currentHost.value;
}

function toggle(): void {
  isOpen.value = !isOpen.value;
}

function close(): void {
  isOpen.value = false;
}

function onDocumentClick(event: MouseEvent): void {
  const target = event.target;

  if (!(target instanceof Node) || !rootRef.value?.contains(target)) {
    close();
  }
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    close();
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onDocumentKeydown);
});

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('keydown', onDocumentKeydown);
});
</script>

<template>
  <div ref="rootRef" class="product-switcher">
    <button
      type="button"
      class="product-switcher-btn"
      :class="{ 'is-open': isOpen }"
      aria-label="Другие продукты"
      :aria-expanded="isOpen"
      @click="toggle"
    >
      <svg
        class="product-switcher-icon"
        viewBox="0 0 16 16"
        aria-hidden="true"
      >
        <rect x="1" y="1" width="3.5" height="3.5" rx="0.8" />
        <rect x="6.25" y="1" width="3.5" height="3.5" rx="0.8" />
        <rect x="11.5" y="1" width="3.5" height="3.5" rx="0.8" />
        <rect x="1" y="6.25" width="3.5" height="3.5" rx="0.8" />
        <rect x="6.25" y="6.25" width="3.5" height="3.5" rx="0.8" />
        <rect x="11.5" y="6.25" width="3.5" height="3.5" rx="0.8" />
        <rect x="1" y="11.5" width="3.5" height="3.5" rx="0.8" />
        <rect x="6.25" y="11.5" width="3.5" height="3.5" rx="0.8" />
        <rect x="11.5" y="11.5" width="3.5" height="3.5" rx="0.8" />
      </svg>
    </button>
    <div v-if="isOpen" class="product-switcher-menu" role="menu">
      <a
        v-for="product in products"
        :key="product.id"
        class="product-switcher-item"
        :class="{ 'is-current': isCurrent(product) }"
        :href="product.href"
        target="_blank"
        rel="noopener noreferrer"
        role="menuitem"
      >
        <span
          class="product-switcher-item-icon"
          :style="{ background: product.iconBg }"
        >
          <img
            v-if="product.iconSrc"
            :src="product.iconSrc"
            alt=""
          >
          <span v-else>{{ product.initial }}</span>
        </span>
        {{ product.name }}
      </a>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.product-switcher {
  position: relative;
  flex-shrink: 0;
}

.product-switcher-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: var(--radius-sm);
  padding: 0;
  background: none;
  color: #b6c2cf;

  &:hover,
  &.is-open {
    background: rgb(255 255 255 / 20%);
    color: #fff;
  }
}

.product-switcher-icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.product-switcher-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 80;
  min-width: 220px;
  padding: 8px;
  background: #282e33;
  border-radius: var(--radius);
  box-shadow: 0 8px 16px #091e4240;
}

.product-switcher-item {
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: var(--radius-sm);
  padding: 8px;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;

  &:hover,
  &.is-current {
    background: rgb(255 255 255 / 12%);
  }
}

.product-switcher-item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 6px;
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
