<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { initials } from '../composables/format.ts';

const props = defineProps<{
  name: string;
  src?: string;
}>();

const failed = ref(false);

watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);

const showImage = computed(() => Boolean(props.src) && !failed.value);

function onError(): void {
  failed.value = true;
}
</script>

<template>
  <span
    class="avatar"
    :title="name"
  >
    <img
      v-if="showImage"
      :src="src"
      alt=""
      referrerpolicy="no-referrer"
      @error="onError"
    >
    <template v-else>
      {{ initials(name) }}
    </template>
  </span>
</template>
