<script setup lang="ts">
import { computed } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import AppHeader from './components/AppHeader.vue';

const route = useRoute();
const showChrome = computed(() => route.meta.chrome === true);
</script>

<template>
  <AppHeader v-if="showChrome" />
  <RouterView />
</template>
