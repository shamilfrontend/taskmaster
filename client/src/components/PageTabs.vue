<script setup lang="ts">
import { useRoute, type RouteLocationRaw } from 'vue-router';

export interface PageTab {
  id: string;
  label: string;
  to: RouteLocationRaw;
}

defineProps<{
  tabs: PageTab[];
}>();

const route = useRoute();

function tabName(to: RouteLocationRaw): string | undefined {
  if (typeof to === 'string' || !('name' in to) || to.name === undefined) {
    return undefined;
  }

  return String(to.name);
}

function tabQuery(to: RouteLocationRaw): string | undefined {
  if (typeof to === 'string' || !('query' in to) || to.query === undefined) {
    return undefined;
  }

  const value = to.query.tab;

  return typeof value === 'string' ? value : undefined;
}

function isActive(tab: PageTab): boolean {
  const name = tabName(tab.to);
  const queryTab = tabQuery(tab.to);
  const currentTab = typeof route.query.tab === 'string'
    ? route.query.tab
    : undefined;

  if (name === 'analytics') {
    return route.name === 'analytics';
  }

  if (name === 'project-expenses') {
    return route.name === 'project-expenses';
  }

  if (name === 'project-releases') {
    return route.name === 'project-releases' || route.name === 'release';
  }

  if (name === 'project-settings') {
    return route.name === 'project-settings';
  }

  if (queryTab) {
    return route.name === name && currentTab === queryTab;
  }

  return route.name === name && currentTab === undefined;
}
</script>

<template>
  <nav class="page-tabs">
    <router-link
      v-for="tab in tabs"
      :key="tab.id"
      :to="tab.to"
      class="page-tab"
      active-class=""
      exact-active-class=""
      :class="{ 'is-active': isActive(tab) }"
    >
      {{ tab.label }}
    </router-link>
  </nav>
</template>

<style lang="scss" scoped>
.page-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 24px;
  border-bottom: 0;
}

.page-tab {
  border: 0;
  border-radius: var(--radius);
  padding: 6px 12px;
  background: none;
  color: var(--muted);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;

  &:hover {
    background: var(--hover);
    color: var(--text);
  }

  &.is-active {
    background: var(--surface);
    color: var(--blue);
    box-shadow: var(--shadow);
  }
}
</style>
