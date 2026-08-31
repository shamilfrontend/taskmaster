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
  background: rgb(0 0 0 / 45%);

  &.is-open {
    display: grid;
  }
}

.modal {
  width: min(440px, 100%);
  max-height: calc(100vh - 48px);
  max-height: calc(100dvh - 48px);
  overflow: auto;
  padding: 16px 16px 14px;
  border: 1px solid rgb(255 255 255 / 28%);
  border-radius: 12px;
  background-image:
    linear-gradient(
      to bottom,
      rgb(255 255 255 / 22%) 0,
      rgb(255 255 255 / 6%) 18%,
      transparent 42%
    ),
    linear-gradient(to bottom, #6e6e72, #3a3a3e 55%, #2c2c30);
  box-shadow: 0 12px 32px rgb(0 0 0 / 5%), inset 0 1px 0 rgb(255 255 255 / 28%);
  color: #fff;
}

.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;

  h2 {
    margin: 0;
    color: #fff;
    font-size: 18px;
    font-weight: 700;
    text-shadow: 0 -1px 0 rgb(0 0 0 / 5%);
  }
}

.icon-btn {
  color: #fff;
  background: rgb(255 255 255 / 12%);
  border-color: rgb(255 255 255 / 22%);

  &:hover {
    background: rgb(255 255 255 / 2%);
    color: #fff;
  }
}

:deep(.muted) {
  color: rgb(255 255 255 / 78%);
}

:deep(.field label) {
  color: rgb(255 255 255 / 78%);
  text-shadow: none;
}

:deep(.input),
:deep(.select) {
  background: #fff;
  color: #111;
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
    padding: 14px;
  }
}
</style>
