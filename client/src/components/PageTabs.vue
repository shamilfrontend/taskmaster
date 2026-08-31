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
@use '../assets/breakpoints' as *;

.page-tabs {
  display: flex;
  overflow: hidden;
  margin: 0 0 16px;
  border: 1px solid #3d5476;
  border-radius: 8px;
  background: #6a80a0;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 28%), 0 1px 1px rgb(0 0 0 / 2%);
}

.page-tab {
  flex: 1;
  min-width: 0;
  padding: 7px 8px;
  border: 0;
  border-right: 1px solid #3d5476;
  background-image:
    linear-gradient(
      to bottom,
      rgb(255 255 255 / 32%) 0,
      rgb(255 255 255 / 6%) 48%,
      transparent 52%
    ),
    linear-gradient(to bottom, #9aadc6 0%, #7b91b0 49%, #6a80a0 51%, #5a6f90 100%);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  text-align: center;
  text-decoration: none;
  text-overflow: ellipsis;
  text-shadow: 0 -1px 0 rgb(0 0 0 / 35%);
  white-space: nowrap;

  &:last-child {
    border-right: 0;
  }

  &:hover {
    color: #fff;
  }

  &.is-active {
    background-image: linear-gradient(to bottom, #314868, #4e678c);
    box-shadow: inset 0 1px 3px rgb(0 0 0 / 4%);
    color: #fff;
  }
}

@media (max-width: $bp-phone) {
  .page-tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .page-tab {
    flex: 1 0 auto;
    padding: 7px 10px;
  }
}
</style>
