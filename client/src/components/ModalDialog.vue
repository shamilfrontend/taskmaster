<script setup lang="ts">
defineProps<{
  open: boolean;
  title: string;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <div
    class="modal-overlay"
    :class="{ 'is-open': open }"
    @click.self="emit('close')"
  >
    <div class="modal" role="dialog">
      <div class="modal-head">
        <h2>{{ title }}</h2>
        <button type="button" class="icon-btn" aria-label="Закрыть" @click="emit('close')">
          ×
        </button>
      </div>
      <slot />
    </div>
  </div>
</template>
