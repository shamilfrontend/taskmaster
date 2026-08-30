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
    <div
      class="modal"
      role="dialog"
    >
      <div class="modal-head">
        <h2>{{ title }}</h2>
        <button
          type="button"
          class="icon-btn"
          aria-label="Закрыть"
          @click="emit('close')"
        >
          ×
        </button>
      </div>
      <slot />
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '../assets/breakpoints' as *;

.modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 46;
  place-items: center;
  padding: 24px;
  padding: max(16px, env(safe-area-inset-top, 0px))
    16px max(16px, env(safe-area-inset-bottom, 0px));
  background: rgb(9 30 66 / 40%);

  &.is-open {
    display: grid;
  }
}

.modal {
  width: min(440px, 100%);
  max-height: calc(100vh - 48px);
  max-height: calc(100dvh - 48px);
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

@media (max-width: $bp-narrow) {
  .modal-overlay {
    padding: 12px;
    padding: max(8px, env(safe-area-inset-top, 0px))
      8px max(8px, env(safe-area-inset-bottom, 0px));
  }

  .modal {
    width: 100%;
    max-height: calc(100vh - 16px);
    max-height: calc(100dvh - 16px);
    padding: 16px;
  }
}
</style>
