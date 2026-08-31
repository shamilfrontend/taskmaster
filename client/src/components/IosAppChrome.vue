<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useNotificationsStore } from '../stores/notifications.ts';
import IosNavBar from './IosNavBar.vue';
import IosTabBar from './IosTabBar.vue';

const notifications = useNotificationsStore();

onMounted(() => {
  document.documentElement.classList.add('ios6');
  notifications.startPolling();
});

onUnmounted(() => {
  document.documentElement.classList.remove('ios6');
  notifications.stopPolling();
});
</script>

<template>
  <div class="ios-chrome">
    <IosNavBar />
    <main class="ios-main">
      <slot />
    </main>
    <IosTabBar />
  </div>
</template>

<style lang="scss" scoped>
.ios-chrome {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
  background-color: var(--bg);
  background-image: var(--pinstripe);
}

.ios-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
}
</style>
