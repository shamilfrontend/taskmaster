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

<style lang="scss" scoped>
.modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 46;
  place-items: center;
  padding: 24px;
  background: rgb(9 30 66 / 40%);

  &.is-open {
    display: grid;
  }
}

.modal {
  width: min(440px, 100%);
  max-height: calc(100vh - 48px);
  overflow: auto;
  padding: 20px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 8px 24px #091e4226;
}

.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
}
</style>
