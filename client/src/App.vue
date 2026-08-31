<script setup lang="ts">
import { computed } from 'vue';
import { Notifications } from '@kyvg/vue3-notification';
import { RouterView, useRoute } from 'vue-router';
import IosAppChrome from './components/IosAppChrome.vue';

const route = useRoute();
const showChrome = computed(() => route.meta.chrome === true);
</script>

<template>
  <IosAppChrome v-if="showChrome">
    <RouterView />
  </IosAppChrome>
  <RouterView v-else />
  <Notifications
    position="top right"
    :duration="4000"
  />
</template>
