<script setup lang="ts">
import { useRouter } from 'vue-router';
import {
  iosRightAction,
  useIosNavigation,
} from '../composables/ios-chrome.ts';

const router = useRouter();
const { title, back } = useIosNavigation();
const rightAction = iosRightAction;

function goBack(): void {
  if (back.value) {
    void router.push(back.value.to);
  }
}
</script>

<template>
  <header class="ios-nav-bar">
    <div class="ios-nav-side ios-nav-side--left">
      <button
        v-if="back"
        type="button"
        class="ios-back"
        @click="goBack"
      >
        <span class="ios-back-arrow" />
        <span class="ios-back-label">{{ back.label }}</span>
      </button>
    </div>
    <h1 class="ios-nav-title">
      {{ title }}
    </h1>
    <div class="ios-nav-side ios-nav-side--right">
      <button
        v-if="rightAction"
        type="button"
        class="ios-nav-action"
        @click="rightAction.handler"
      >
        {{ rightAction.label }}
      </button>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.ios-nav-bar {
  position: relative;
  z-index: 30;
  display: grid;
  grid-template-columns: minmax(72px, 1fr) minmax(0, 2fr) minmax(72px, 1fr);
  align-items: center;
  height: var(--nav-h);
  padding: 0 6px;
  padding-top: env(safe-area-inset-top, 0px);
  height: calc(var(--nav-h) + env(safe-area-inset-top, 0px));
  border-bottom: 1px solid #2d3642;
  background-image:
    linear-gradient(
      to bottom,
      rgb(255 255 255 / 38%) 0,
      rgb(255 255 255 / 8%) 48%,
      transparent 52%
    ),
    linear-gradient(to bottom, #b4c1d2 0%, #8ea0b8 4%, #6d84a2 49%, #546a8a 51%, #4a5d7a 100%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 42%), 0 1px 2px rgb(0 0 0 / 28%);
  color: #fff;
}

.ios-nav-title {
  margin: 0;
  overflow: hidden;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.01em;
  line-height: 1.1;
  text-align: center;
  text-overflow: ellipsis;
  text-shadow: 0 -1px 0 rgb(0 0 0 / 45%);
  white-space: nowrap;
}

.ios-nav-side {
  display: flex;
  align-items: center;
  min-width: 0;

  &--right {
    justify-content: flex-end;
  }
}

.ios-back {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  height: 30px;
  margin-left: 8px;
  padding: 0 10px 0 6px;
  border: 1px solid #395073;
  border-radius: 6px;
  background-image:
    linear-gradient(
      to bottom,
      rgb(255 255 255 / 32%) 0,
      rgb(255 255 255 / 6%) 48%,
      transparent 52%
    ),
    linear-gradient(to bottom, #8aa0bd, #617ea6 49%, #4e6b96 51%, #3f5980);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 35%), 0 1px 1px rgb(0 0 0 / 25%);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  text-shadow: 0 -1px 0 rgb(0 0 0 / 4%);

  &:active {
    background-image: linear-gradient(to bottom, #3a5478, #547296);
  }
}

.ios-back-arrow {
  width: 0;
  height: 0;
  margin-right: 5px;
  border-top: 5px solid transparent;
  border-right: 6px solid #fff;
  border-bottom: 5px solid transparent;
  filter: drop-shadow(0 -1px 0 rgb(0 0 0 / 35%));
}

.ios-back-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ios-nav-action {
  height: 30px;
  padding: 0 10px;
  border: 1px solid #395073;
  border-radius: 6px;
  background-image:
    linear-gradient(
      to bottom,
      rgb(255 255 255 / 32%) 0,
      rgb(255 255 255 / 6%) 48%,
      transparent 52%
    ),
    linear-gradient(to bottom, #8aa0bd, #617ea6 49%, #4e6b96 51%, #3f5980);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 35%), 0 1px 1px rgb(0 0 0 / 25%);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  text-shadow: 0 -1px 0 rgb(0 0 0 / 4%);

  &:active {
    background-image: linear-gradient(to bottom, #3a5478, #547296);
  }
}
</style>
