<script setup lang="ts">
import { useProjectStore } from '../stores/project.ts';
import BoardView from './BoardView.vue';

const projects = useProjectStore();
</script>

<template>
  <BoardView
    v-if="projects.current?.board.id"
    :key="projects.current.board.id"
  />
  <p
    v-else
    class="muted"
  >
    Загрузка…
  </p>
</template>
