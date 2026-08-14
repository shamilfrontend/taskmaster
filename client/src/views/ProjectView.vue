<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '../stores/project.ts';
import { formatMoney } from '../composables/format.ts';
import ModalDialog from '../components/ModalDialog.vue';
import type { TeamRole } from '../types/index.ts';

const route = useRoute();
const router = useRouter();
const projects = useProjectStore();
const projectId = computed(() => String(route.params.projectId));

const budgetOpen = ref(false);
const budgetLimit = ref('0');
const boardOpen = ref(false);
const boardName = ref('');
const releaseOpen = ref(false);
const releaseName = ref('');
const releaseDate = ref('');
const ratesOpen = ref(false);
const roleRates = ref<Record<TeamRole, number>>({
  owner: 0,
  admin: 0,
  member: 0,
  viewer: 0
});

onMounted(async () => {
  await projects.fetchOne(projectId.value);

  if (projects.current?.roleRates) {
    roleRates.value = { ...projects.current.roleRates };
  }

  if (projects.current?.budgetLimit !== undefined) {
    budgetLimit.value = String(projects.current.budgetLimit);
  }
});

const canAdmin = computed(() => {
  const role = projects.current?.role;
  return role === 'owner' || role === 'admin';
});

async function saveBudget(): Promise<void> {
  await projects.updateBudget(projectId.value, Number(budgetLimit.value));
  budgetOpen.value = false;
}

async function createBoard(): Promise<void> {
  const id = await projects.createBoard(projectId.value, boardName.value);

  if (id) {
    boardOpen.value = false;
    await router.push({ name: 'board', params: { boardId: id } });
  }
}

async function createRelease(): Promise<void> {
  const id = await projects.createRelease(
    projectId.value,
    releaseName.value,
    releaseDate.value || undefined
  );

  if (id) {
    releaseOpen.value = false;
    await router.push({ name: 'release', params: { releaseId: id } });
  }
}

async function saveRates(): Promise<void> {
  await projects.saveRoleRates(projectId.value, roleRates.value);
  ratesOpen.value = false;
}
</script>

<template>
  <section v-if="projects.current" class="screen is-active">
    <div class="wrap">
      <div class="page-head">
        <div>
          <h1>{{ projects.current.name }}</h1>
          <p>валюта RUB</p>
        </div>
        <div class="actions">
          <button
            type="button"
            class="btn btn-ghost"
            @click="router.push({ name: 'analytics', params: { projectId: projectId } })"
          >
            Аналитика
          </button>
          <button
            v-if="projects.current.role === 'owner'"
            type="button"
            class="btn btn-ghost"
            @click="budgetOpen = true"
          >
            Изменить бюджет
          </button>
          <button v-if="canAdmin" type="button" class="btn" @click="boardOpen = true">
            Создать доску
          </button>
        </div>
      </div>
      <p v-if="projects.error" class="warn">{{ projects.error }}</p>
      <div
        v-if="projects.current.remainder !== undefined && projects.current.remainder < 0"
        class="warn"
      >
        Бюджет превышен. Списания не блокируются.
      </div>
      <div class="grid-3 mb-16">
        <div v-if="projects.current.budgetLimit !== undefined" class="panel stat">
          <div class="label">Бюджет</div>
          <div class="value">{{ formatMoney(projects.current.budgetLimit) }}</div>
        </div>
        <div v-if="projects.current.fact !== undefined" class="panel stat">
          <div class="label">Факт</div>
          <div class="value">{{ formatMoney(projects.current.fact) }}</div>
        </div>
        <div v-if="projects.current.remainder !== undefined" class="panel stat">
          <div class="label">Остаток</div>
          <div class="value" :class="{ neg: projects.current.remainder < 0 }">
            {{ formatMoney(projects.current.remainder) }}
          </div>
        </div>
      </div>
      <div class="grid-2 mb-16">
        <div class="panel">
          <h2>Доски</h2>
          <button
            v-for="board in projects.current.boards"
            :key="board.id"
            type="button"
            class="card board-tile full mb-12"
            @click="router.push({ name: 'board', params: { boardId: board.id } })"
          >
            <strong>{{ board.name }}</strong>
            <span class="muted">{{ board.columnCount }} колонки · {{ board.cardCount }} карточек</span>
          </button>
        </div>
        <div class="panel">
          <h2>Релизы</h2>
          <button
            v-for="release in projects.current.releases"
            :key="release.id"
            type="button"
            class="project-row row-btn"
            @click="router.push({ name: 'release', params: { releaseId: release.id } })"
          >
            <div class="grow">
              <div>{{ release.name }}</div>
              <div class="muted">{{ release.cardCount }} карточки</div>
            </div>
            <span
              class="badge"
              :class="release.status === 'released' ? 'badge-released' : 'badge-planned'"
            >
              {{ release.status }}
            </span>
          </button>
          <div v-if="canAdmin" class="pt-12">
            <button type="button" class="btn btn-ghost" @click="releaseOpen = true">
              Создать релиз
            </button>
          </div>
        </div>
      </div>
      <div v-if="projects.current.roleRates" class="panel">
        <h2>Ставки, ₽/час</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Участник</th>
              <th>Источник</th>
              <th>Ставка</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in projects.current.rates" :key="row.userId">
              <td>{{ row.displayName }}</td>
              <td class="muted">{{ row.source === 'personal' ? 'персональная' : 'роль ' + row.role }}</td>
              <td>{{ row.amount }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="canAdmin" class="pt-12">
          <button type="button" class="btn btn-ghost" @click="ratesOpen = true">
            Ставки ролей
          </button>
        </div>
      </div>
    </div>

    <ModalDialog :open="budgetOpen" title="Бюджет проекта" @close="budgetOpen = false">
      <div class="field">
        <label>Лимит, ₽</label>
        <input v-model="budgetLimit" class="input" type="number" min="0">
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" @click="budgetOpen = false">Отмена</button>
        <button type="button" class="btn" @click="saveBudget">Сохранить</button>
      </div>
    </ModalDialog>

    <ModalDialog :open="boardOpen" title="Создать доску" @close="boardOpen = false">
      <div class="field">
        <label>Название</label>
        <input v-model="boardName" class="input" type="text">
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" @click="boardOpen = false">Отмена</button>
        <button type="button" class="btn" @click="createBoard">Создать</button>
      </div>
    </ModalDialog>

    <ModalDialog :open="releaseOpen" title="Создать релиз" @close="releaseOpen = false">
      <div class="field">
        <label>Название</label>
        <input v-model="releaseName" class="input" type="text">
      </div>
      <div class="field">
        <label>Дата релиза</label>
        <input v-model="releaseDate" class="input" type="date">
      </div>
      <p class="muted mb-16">При создании статус всегда planned.</p>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" @click="releaseOpen = false">Отмена</button>
        <button type="button" class="btn" @click="createRelease">Создать</button>
      </div>
    </ModalDialog>

    <ModalDialog :open="ratesOpen" title="Ставки ролей" @close="ratesOpen = false">
      <div v-for="role in (['owner', 'admin', 'member', 'viewer'] as TeamRole[])" :key="role" class="field">
        <label>{{ role }}</label>
        <input v-model.number="roleRates[role]" class="input" type="number" min="0">
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" @click="ratesOpen = false">Отмена</button>
        <button type="button" class="btn" @click="saveRates">Сохранить</button>
      </div>
    </ModalDialog>
  </section>
</template>
