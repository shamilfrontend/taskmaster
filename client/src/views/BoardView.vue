<script setup lang="ts">
import {
  computed, nextTick, onMounted, onUnmounted, ref, watch,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.ts';
import { useBoardStore } from '../stores/board.ts';
import { useProjectStore } from '../stores/project.ts';
import {
  formatDate,
  isOverdue,
  labelClass,
  linkifyText,
} from '../composables/format.ts';
import ModalDialog from '../components/ModalDialog.vue';
import UserAvatar from '../components/UserAvatar.vue';
import type {
  BoardCard,
  BoardColumn,
  CardChecklist,
  CardComment,
  LabelColor,
  TimeEntry,
} from '../types/index.ts';

const CARD_DRAG = 'card:';
const COLUMN_DRAG = 'column:';

type DragKind = 'card' | 'column';

const route = useRoute();
const router = useRouter();
const dragKind = ref<DragKind | null>(null);
const dragCardId = ref<string | null>(null);
const dragColumnId = ref<string | null>(null);
const dropColumnId = ref<string | null>(null);
const dropIndex = ref<number | null>(null);

const auth = useAuthStore();
const board = useBoardStore();
const project = useProjectStore();
const boardId = computed(() => project.current?.board?.id ?? '');
const cardOpen = ref(false);
const hoursOpen = ref(false);
const labelsOpen = ref(false);
const hours = ref(2);
const hoursWorkedAt = ref('');
const editingEntryId = ref<string | null>(null);
const cardTitle = ref('');
const descEditing = ref(false);
const descDraft = ref('');
const descExpanded = ref(false);
const descNeedsToggle = ref(false);
const descBodyRef = ref<HTMLElement | null>(null);
const checklistDrafts = ref<Record<string, string>>({});
const itemDrafts = ref<Record<string, string>>({});
const newItemText = ref<Record<string, string>>({});
const comment = ref('');
const replyTo = ref<{ id: string; displayName: string } | null>(null);
const editingCommentId = ref<string | null>(null);
const editingBody = ref('');
const labelName = ref('');
const labelColor = ref<LabelColor>('blue');
const labelDrafts = ref<Record<string, string>>({});
interface MenuPosition {
  top: string;
  right: string;
}

interface CommentThread {
  root: CardComment;
  items: CardComment[];
}

const renamingId = ref<string | null>(null);
const renameValue = ref('');
const menuColumnId = ref<string | null>(null);
const menuCardId = ref<string | null>(null);
const menuPosition = ref<MenuPosition | null>(null);
const addingCardColumnId = ref<string | null>(null);
const newCardTitle = ref('');
const addingColumn = ref(false);
const newColumnName = ref('');
const cardDeleteOpen = ref(false);
const cardToDelete = ref<{ id: string; title: string } | null>(null);
const columnDeleteOpen = ref(false);
const columnToDelete = ref<BoardColumn | null>(null);
const filterQuery = ref('');
const filterAssignee = ref('');
const filterLabelId = ref('');
const filterReleaseId = ref('');
const filterDue = ref('');
const filterEstimate = ref('');
const filterColumnId = ref('');

onMounted(() => {
  document.addEventListener('click', closeMenus);
  window.addEventListener('scroll', closeMenus, true);
  window.addEventListener('resize', closeMenus);
});

onUnmounted(() => {
  document.removeEventListener('click', closeMenus);
  window.removeEventListener('scroll', closeMenus, true);
  window.removeEventListener('resize', closeMenus);
});

watch(boardId, async (id) => {
  if (!id) {
    board.reset();
    return;
  }

  renamingId.value = null;
  closeMenus();
  addingCardColumnId.value = null;
  addingColumn.value = false;
  cardOpen.value = false;
  filterQuery.value = '';
  filterLabelId.value = '';
  applyFiltersFromQuery();
  await board.fetchBoard(id);
}, { immediate: true });

watch(
  () => board.current?.labels,
  (labels) => {
    if (!labels) {
      labelDrafts.value = {};
      return;
    }

    labelDrafts.value = Object.fromEntries(
      labels.map((label) => [
        label.id,
        labelDrafts.value[label.id] ?? label.name,
      ]),
    );
  },
  { immediate: true },
);

watch(addingCardColumnId, async (id) => {
  if (!id) {
    return;
  }

  await nextTick();
  document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus();
});

watch(addingColumn, async (open) => {
  if (!open) {
    return;
  }

  await nextTick();
  document.querySelector<HTMLInputElement>('.add-list .input')?.focus();
});

watch(renamingId, async (id) => {
  if (!id) {
    return;
  }

  await nextTick();
  const input = document.querySelector<HTMLInputElement>('.column-title-input');
  input?.focus();
  input?.select();
});

const canEdit = computed(() => {
  const role = board.current?.role;
  return role === 'owner' || role === 'admin' || role === 'member';
});

const canAdmin = computed(() => {
  const role = board.current?.role;
  return role === 'owner' || role === 'admin';
});

const showMoney = computed(() => project.current?.budgetEnabled === true);

const showReleases = computed(() => project.current?.releasesEnabled === true);

const canLogHours = computed(() => {
  const role = board.current?.role;
  const userId = auth.user?.id;

  if (role === 'owner' || role === 'admin') {
    return true;
  }

  return role === 'member' && board.card?.assigneeId === userId;
});

const canDeleteCard = computed(() => {
  if (!canEdit.value || !board.card) {
    return false;
  }

  return board.card.timeEntries.length === 0 || canAdmin.value;
});

const factHours = computed(() => (
  board.card?.timeEntries ?? []
).reduce((sum, entry) => sum + entry.hours, 0));

const factAmount = computed(() => {
  if (!showMoney.value || !board.card) {
    return null;
  }

  const total = board.card.timeEntries.reduce(
    (sum, entry) => sum + (entry.amount ?? 0),
    0,
  );

  return total;
});

const cardColumnName = computed(() => {
  const columnId = board.card?.columnId;

  if (!columnId || !board.current) {
    return '';
  }

  return board.current.columns.find((item) => item.id === columnId)?.name ?? '';
});

const assigneeSelectRef = ref<HTMLSelectElement | null>(null);
const dueDateInputRef = ref<HTMLInputElement | null>(null);

const menuColumn = computed(() => {
  if (!menuColumnId.value) {
    return null;
  }

  return board.current?.columns.find((item) => item.id === menuColumnId.value)
    ?? null;
});

const menuCard = computed(() => {
  if (!menuCardId.value) {
    return null;
  }

  return board.current?.cards.find((item) => item.id === menuCardId.value)
    ?? null;
});

const columnHasCards = computed(() => {
  if (!columnToDelete.value) {
    return false;
  }

  return allCardsOf(columnToDelete.value.id).length > 0;
});

const filtersActive = computed(() => (
  filterQuery.value.trim() !== ''
    || filterAssignee.value !== ''
    || filterLabelId.value !== ''
    || filterReleaseId.value !== ''
    || filterDue.value !== ''
    || filterEstimate.value !== ''
    || filterColumnId.value !== ''
));

function closeMenus(): void {
  menuColumnId.value = null;
  menuCardId.value = null;
  menuPosition.value = null;
}

function canDeleteBoardCard(card: BoardCard): boolean {
  if (!canEdit.value) {
    return false;
  }

  return card.factHours === 0 || canAdmin.value;
}

function queryParam(key: string): string {
  const value = route.query[key];
  return typeof value === 'string' ? value : '';
}

function applyFiltersFromQuery(): void {
  const due = queryParam('due');
  filterDue.value = due === 'overdue' ? 'overdue' : '';

  const estimate = queryParam('estimate');
  filterEstimate.value = estimate === 'none' ? 'none' : '';

  filterAssignee.value = queryParam('assignee');
  filterReleaseId.value = queryParam('release');
  filterColumnId.value = queryParam('column');
}

function filterQueryState(): Record<string, string> {
  const next: Record<string, string> = {};

  if (filterDue.value) {
    next.due = filterDue.value;
  }

  if (filterAssignee.value) {
    next.assignee = filterAssignee.value;
  }

  if (filterEstimate.value) {
    next.estimate = filterEstimate.value;
  }

  if (filterReleaseId.value) {
    next.release = filterReleaseId.value;
  }

  if (filterColumnId.value) {
    next.column = filterColumnId.value;
  }

  return next;
}

function syncFiltersToQuery(): void {
  const next = filterQueryState();
  const currentDue = queryParam('due');
  const currentAssignee = queryParam('assignee');
  const currentEstimate = queryParam('estimate');
  const currentRelease = queryParam('release');
  const currentColumn = queryParam('column');

  if (
    (next.due ?? '') === currentDue
    && (next.assignee ?? '') === currentAssignee
    && (next.estimate ?? '') === currentEstimate
    && (next.release ?? '') === currentRelease
    && (next.column ?? '') === currentColumn
  ) {
    return;
  }

  const query: Record<string, string> = { ...next };
  const card = queryParam('card');

  if (card) {
    query.card = card;
  }

  void router.replace({ query });
}

function cardIsOverdue(card: BoardCard): boolean {
  const column = board.current?.columns.find(
    (item) => item.id === card.columnId,
  );

  return isOverdue(card.dueDate, column?.isDone ?? false);
}

function clearFilters(): void {
  filterQuery.value = '';
  filterAssignee.value = '';
  filterLabelId.value = '';
  filterReleaseId.value = '';
  filterDue.value = '';
  filterEstimate.value = '';
  filterColumnId.value = '';
}

function matchesFilters(card: BoardCard): boolean {
  const query = filterQuery.value.trim().toLowerCase();

  if (query && !card.title.toLowerCase().includes(query)) {
    return false;
  }

  if (filterAssignee.value === 'none' && card.assigneeId !== null) {
    return false;
  }

  if (
    filterAssignee.value !== ''
    && filterAssignee.value !== 'none'
    && card.assigneeId !== filterAssignee.value
  ) {
    return false;
  }

  if (
    filterLabelId.value !== ''
    && !card.labelIds.includes(filterLabelId.value)
  ) {
    return false;
  }

  if (filterReleaseId.value === 'none' && card.releaseId !== null) {
    return false;
  }

  if (
    filterReleaseId.value !== ''
    && filterReleaseId.value !== 'none'
    && card.releaseId !== filterReleaseId.value
  ) {
    return false;
  }

  if (filterDue.value === 'overdue' && !cardIsOverdue(card)) {
    return false;
  }

  if (filterEstimate.value === 'none' && card.estimateHours !== 0) {
    return false;
  }

  if (
    filterColumnId.value !== ''
    && card.columnId !== filterColumnId.value
  ) {
    return false;
  }

  return true;
}

function allCardsOf(id: string): BoardCard[] {
  return (board.current?.cards ?? [])
    .filter((card) => card.columnId === id)
    .slice()
    .sort((a, b) => a.position - b.position);
}

function visibleCardsOf(id: string): BoardCard[] {
  return allCardsOf(id).filter((card) => matchesFilters(card));
}

function toDateInput(value: string | Date | null | undefined): string {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);

    if (match?.[1]) {
      return match[1];
    }
  }

  const date = typeof value === 'string' ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

async function openCard(id: string): Promise<void> {
  await board.fetchCard(id);
  cardTitle.value = board.card?.title ?? '';
  descEditing.value = false;
  descDraft.value = board.card?.description ?? '';
  descExpanded.value = false;
  comment.value = '';
  replyTo.value = null;
  editingCommentId.value = null;
  editingBody.value = '';
  cardOpen.value = true;
  await measureDescription();
}

watch(
  () => [board.current?.id, route.query.card] as const,
  async ([loadedBoardId, cardQuery]) => {
    const cardFromQuery = typeof cardQuery === 'string' ? cardQuery : '';

    if (!loadedBoardId || !cardFromQuery || cardOpen.value) {
      return;
    }

    if (!board.current?.cards.some((item) => item.id === cardFromQuery)) {
      return;
    }

    await openCard(cardFromQuery);
  },
);

watch(
  () => [
    route.query.due,
    route.query.assignee,
    route.query.estimate,
    route.query.release,
    route.query.column,
  ],
  () => {
    applyFiltersFromQuery();
  },
);

watch(
  [filterDue, filterAssignee, filterEstimate, filterReleaseId, filterColumnId],
  () => {
    syncFiltersToQuery();
  },
);

async function measureDescription(): Promise<void> {
  await nextTick();
  const el = descBodyRef.value;

  if (!el || !board.card?.description) {
    descNeedsToggle.value = false;
    return;
  }

  descNeedsToggle.value = el.scrollHeight > 100;
}

function toggleDescription(): void {
  descExpanded.value = !descExpanded.value;
}

async function focusAssigneeField(): Promise<void> {
  await nextTick();
  assigneeSelectRef.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  assigneeSelectRef.value?.focus();
}

async function focusDueDateField(): Promise<void> {
  await nextTick();
  dueDateInputRef.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  dueDateInputRef.value?.focus();
}

function placeMenu(event: MouseEvent): MenuPosition | null {
  const button = event.currentTarget;

  if (!(button instanceof HTMLElement)) {
    return null;
  }

  const rect = button.getBoundingClientRect();

  return {
    top: `${Math.round(rect.bottom + 4)}px`,
    right: `${Math.round(window.innerWidth - rect.right)}px`,
  };
}

function toggleMenu(event: MouseEvent, columnId: string): void {
  if (menuColumnId.value === columnId) {
    closeMenus();
    return;
  }

  const position = placeMenu(event);

  if (!position) {
    return;
  }

  menuCardId.value = null;
  menuColumnId.value = columnId;
  menuPosition.value = position;
}

function toggleCardMenu(event: MouseEvent, cardId: string): void {
  if (menuCardId.value === cardId) {
    closeMenus();
    return;
  }

  const position = placeMenu(event);

  if (!position) {
    return;
  }

  menuColumnId.value = null;
  menuCardId.value = cardId;
  menuPosition.value = position;
}

function openCardDelete(card: BoardCard): void {
  if (!canDeleteBoardCard(card)) {
    return;
  }

  cardToDelete.value = { id: card.id, title: card.title };
  cardDeleteOpen.value = true;
  closeMenus();
}

async function copyCard(card: BoardCard): Promise<void> {
  if (!canEdit.value || !boardId.value) {
    return;
  }

  closeMenus();
  await board.createCard({
    boardId: boardId.value,
    columnId: card.columnId,
    title: card.title,
    ...(card.assigneeId ? { assigneeId: card.assigneeId } : {}),
    ...(card.dueDate ? { dueDate: toDateInput(card.dueDate) } : {}),
    estimateHours: card.estimateHours,
    ...(card.releaseId ? { releaseId: card.releaseId } : {}),
    ...(card.labelIds.length > 0 ? { labelIds: [...card.labelIds] } : {}),
  });
}

function openCardDeleteFromModal(): void {
  if (!board.card || !canDeleteCard.value) {
    return;
  }

  cardToDelete.value = {
    id: board.card.id,
    title: board.card.title,
  };
  cardDeleteOpen.value = true;
}

function startRename(column: BoardColumn): void {
  if (!canAdmin.value) {
    return;
  }

  renamingId.value = column.id;
  renameValue.value = column.name;
  closeMenus();
}

async function saveRename(columnId: string): Promise<void> {
  const name = renameValue.value.trim();
  const currentName = board.current?.columns.find((item) => item.id === columnId)
    ?.name;
  renamingId.value = null;

  if (!name || name === currentName) {
    return;
  }

  await board.patchColumn(columnId, { name });
}

function openColumnDelete(column: BoardColumn): void {
  columnToDelete.value = column;
  columnDeleteOpen.value = true;
  closeMenus();
}

async function removeColumn(): Promise<void> {
  if (!columnToDelete.value || columnHasCards.value) {
    return;
  }

  await board.deleteColumn(columnToDelete.value.id);
  columnDeleteOpen.value = false;
  columnToDelete.value = null;
}

function openCardComposer(columnId: string): void {
  addingCardColumnId.value = columnId;
  newCardTitle.value = '';
  addingColumn.value = false;
  closeMenus();
}

function cancelCardComposer(): void {
  addingCardColumnId.value = null;
  newCardTitle.value = '';
}

async function submitCard(columnId: string): Promise<void> {
  const title = newCardTitle.value.trim();

  if (!title) {
    return;
  }

  await board.createCard({
    boardId: boardId.value,
    columnId,
    title,
  });
  newCardTitle.value = '';
  await nextTick();
  document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus();
}

function openColumnComposer(): void {
  addingColumn.value = true;
  newColumnName.value = '';
  addingCardColumnId.value = null;
  closeMenus();
}

function cancelColumnComposer(): void {
  addingColumn.value = false;
  newColumnName.value = '';
}

async function submitColumn(): Promise<void> {
  const name = newColumnName.value.trim();

  if (!name || !board.current) {
    return;
  }

  await board.addColumn(board.current.id, name);
  newColumnName.value = '';
  await nextTick();
  document.querySelector<HTMLInputElement>('.add-list .input')?.focus();
}

function resetDragState(): void {
  dragKind.value = null;
  dragCardId.value = null;
  dragColumnId.value = null;
  dropColumnId.value = null;
  dropIndex.value = null;
}

function siblingCards(columnId: string): BoardCard[] {
  return allCardsOf(columnId).filter((card) => card.id !== dragCardId.value);
}

function isForeignCardDrop(columnId: string): boolean {
  return (
    dragKind.value === 'card'
    && dropColumnId.value === columnId
    && dragColumnId.value !== columnId
  );
}

function isNoopDrop(columnId: string): boolean {
  if (dragColumnId.value !== columnId || dropIndex.value === null) {
    return false;
  }

  const from = allCardsOf(columnId).findIndex(
    (card) => card.id === dragCardId.value,
  );

  return dropIndex.value === from;
}

function cardDropEdge(
  columnId: string,
  cardId: string,
): 'before' | 'after' | null {
  if (
    dragKind.value !== 'card'
    || dropColumnId.value !== columnId
    || dropIndex.value === null
    || cardId === dragCardId.value
    || isNoopDrop(columnId)
  ) {
    return null;
  }

  const siblings = siblingCards(columnId);
  const index = siblings.findIndex((card) => card.id === cardId);

  if (index < 0) {
    return null;
  }

  if (dropIndex.value === index) {
    return 'before';
  }

  if (
    dropIndex.value === siblings.length
    && index === siblings.length - 1
  ) {
    return 'after';
  }

  return null;
}

function showEmptyDrop(columnId: string): boolean {
  return (
    dragKind.value === 'card'
    && dropColumnId.value === columnId
    && dropIndex.value === 0
    && allCardsOf(columnId).length === 0
  );
}

function onColumnDragStart(event: DragEvent, columnId: string): void {
  const target = event.target as HTMLElement | null;

  if (target?.closest('button, input') || !canAdmin.value) {
    event.preventDefault();
    return;
  }

  event.dataTransfer?.setData('text/plain', `${COLUMN_DRAG}${columnId}`);
  dragKind.value = 'column';
}

function onCardDragStart(
  event: DragEvent,
  cardId: string,
  columnId: string,
): void {
  event.dataTransfer?.setData('text/plain', `${CARD_DRAG}${cardId}`);
  dragKind.value = 'card';
  dragCardId.value = cardId;
  dragColumnId.value = columnId;
}

function onColumnDragOver(event: DragEvent, columnId: string): void {
  event.preventDefault();

  if (dragKind.value !== 'card') {
    return;
  }

  dropColumnId.value = columnId;

  const columnEl = event.currentTarget;

  if (!(columnEl instanceof HTMLElement)) {
    return;
  }

  const tasks = columnEl.querySelectorAll<HTMLElement>(
    '.column-cards .task:not(.is-dragging)',
  );
  const lastTask = tasks[tasks.length - 1];

  if (!lastTask) {
    dropIndex.value = 0;
    return;
  }

  if (event.clientY >= lastTask.getBoundingClientRect().bottom) {
    dropIndex.value = siblingCards(columnId).length;
  }
}

function onCardDragOver(
  event: DragEvent,
  columnId: string,
  cardId: string,
): void {
  event.preventDefault();
  event.stopPropagation();

  if (dragKind.value !== 'card' || cardId === dragCardId.value) {
    return;
  }

  const target = event.currentTarget;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const rect = target.getBoundingClientRect();
  const ratio = (event.clientY - rect.top) / rect.height;
  const siblings = siblingCards(columnId);
  const index = siblings.findIndex((card) => card.id === cardId);

  if (index < 0) {
    return;
  }

  let next: number | null = null;

  if (ratio < 0.35) {
    next = index;
  } else if (ratio > 0.65) {
    next = index + 1;
  }

  if (next === null) {
    return;
  }

  dropColumnId.value = columnId;
  dropIndex.value = next;
}

function onDragEnd(): void {
  resetDragState();
}

async function onDrop(event: DragEvent, targetColumnId: string): Promise<void> {
  const raw = event.dataTransfer?.getData('text/plain') ?? '';
  const insertAt = dropIndex.value;

  resetDragState();

  if (raw.startsWith(COLUMN_DRAG) && canAdmin.value) {
    const dragId = raw.slice(COLUMN_DRAG.length);
    const columns = board.current?.columns ?? [];
    const from = columns.findIndex((item) => item.id === dragId);
    const to = columns.findIndex((item) => item.id === targetColumnId);

    if (from < 0 || to < 0 || from === to) {
      return;
    }

    const ordered = columns.map((item) => item.id);
    const moved = ordered[from];

    if (moved === undefined) {
      return;
    }

    ordered.splice(from, 1);
    ordered.splice(to, 0, moved);
    await board.reorderColumns(ordered);
    return;
  }

  if (!raw.startsWith(CARD_DRAG) || !canEdit.value) {
    return;
  }

  const cardId = raw.slice(CARD_DRAG.length);
  const others = allCardsOf(targetColumnId).filter(
    (card) => card.id !== cardId,
  );
  const to = insertAt === null
    ? others.length
    : Math.max(0, Math.min(insertAt, others.length));
  const currentIds = allCardsOf(targetColumnId).map((card) => card.id);
  const nextIds = others.map((card) => card.id);

  nextIds.splice(to, 0, cardId);

  if (currentIds.join() === nextIds.join()) {
    return;
  }

  await Promise.all(
    nextIds.map((id, position) => board.moveCard(id, targetColumnId, position)),
  );
  await board.fetchBoard(boardId.value);
}

async function saveTitle(): Promise<void> {
  if (!board.card || !canEdit.value) {
    return;
  }

  const title = cardTitle.value.trim();

  if (!title || title === board.card.title) {
    cardTitle.value = board.card.title;
    return;
  }

  await board.patchCard(board.card.id, { title });
}

async function saveDueDate(event: Event): Promise<void> {
  if (!board.card || !canEdit.value) {
    return;
  }

  const { value } = (event.target as HTMLInputElement);
  const next = value || null;
  const current = toDateInput(board.card.dueDate) || null;

  if (next === current) {
    return;
  }

  await board.patchCard(board.card.id, { dueDate: next });
}

async function saveEstimate(event: Event): Promise<void> {
  if (!board.card || !canEdit.value) {
    return;
  }

  const raw = Number((event.target as HTMLInputElement).value);

  if (!Number.isFinite(raw) || raw === board.card.estimateHours) {
    return;
  }

  await board.patchCard(board.card.id, { estimateHours: raw });
}

async function saveRelease(event: Event): Promise<void> {
  if (!board.card || !canEdit.value) {
    return;
  }

  const { value } = (event.target as HTMLSelectElement);
  const next = value || null;

  if (next === board.card.releaseId) {
    return;
  }

  await board.patchCard(board.card.id, { releaseId: next });
}

function startEditDescription(): void {
  if (!canEdit.value) {
    return;
  }

  descDraft.value = board.card?.description ?? '';
  descEditing.value = true;
}

function onDescriptionClick(event: MouseEvent): void {
  const { target } = event;

  if (
    target instanceof HTMLElement
    && target.closest('a')
  ) {
    return;
  }

  startEditDescription();
}

async function saveDescription(): Promise<void> {
  if (!board.card || !canEdit.value) {
    return;
  }

  const next = descDraft.value.trim();

  if (next !== (board.card.description ?? '')) {
    await board.patchCard(board.card.id, { description: next });
  }

  descEditing.value = false;
  descExpanded.value = false;
  await measureDescription();
}

function cancelDescription(): void {
  descEditing.value = false;
  descDraft.value = board.card?.description ?? '';
  void measureDescription();
}

function checklistDoneCount(list: CardChecklist): number {
  return list.items.filter((item) => item.done).length;
}

function checklistPercent(list: CardChecklist): number {
  if (list.items.length === 0) {
    return 0;
  }

  return Math.round((checklistDoneCount(list) / list.items.length) * 100);
}

function syncChecklistDrafts(): void {
  const titles: Record<string, string> = {};
  const items: Record<string, string> = {};

  for (const list of board.card?.checklists ?? []) {
    titles[list.id] = list.title;

    for (const item of list.items) {
      items[item.id] = item.text;
    }
  }

  checklistDrafts.value = titles;
  itemDrafts.value = items;
}

async function addChecklist(): Promise<void> {
  if (!board.card || !canEdit.value) {
    return;
  }

  await board.addChecklist(board.card.id);
}

async function saveChecklistTitle(checklistId: string): Promise<void> {
  if (!canEdit.value) {
    return;
  }

  const title = (checklistDrafts.value[checklistId] ?? '').trim();
  const current = board.card?.checklists.find((list) => list.id === checklistId);

  if (!current || !title || title === current.title) {
    if (current) {
      checklistDrafts.value[checklistId] = current.title;
    }

    return;
  }

  await board.renameChecklist(checklistId, title);
}

async function addItem(checklistId: string): Promise<void> {
  if (!canEdit.value) {
    return;
  }

  const text = (newItemText.value[checklistId] ?? '').trim();

  if (!text) {
    return;
  }

  await board.addChecklistItem(checklistId, text);
  newItemText.value[checklistId] = '';
}

async function saveItemText(itemId: string): Promise<void> {
  if (!canEdit.value) {
    return;
  }

  const text = (itemDrafts.value[itemId] ?? '').trim();
  const item = board.card?.checklists
    .flatMap((list) => list.items)
    .find((row) => row.id === itemId);

  if (!item || !text || text === item.text) {
    if (item) {
      itemDrafts.value[itemId] = item.text;
    }

    return;
  }

  await board.patchChecklistItem(itemId, { text });
}

async function toggleItem(itemId: string, done: boolean): Promise<void> {
  if (!canEdit.value) {
    return;
  }

  await board.patchChecklistItem(itemId, { done });
}

watch(
  () => board.card,
  () => {
    syncChecklistDrafts();
  },
);

async function toggleLabel(labelId: string): Promise<void> {
  if (!board.card || !canEdit.value) {
    return;
  }

  const current = board.card.labelIds;
  const labelIds = current.includes(labelId)
    ? current.filter((id) => id !== labelId)
    : [...current, labelId];

  await board.patchCard(board.card.id, { labelIds });
}

function canManageEntry(entry: TimeEntry): boolean {
  const role = board.current?.role;

  if (role === 'owner' || role === 'admin') {
    return true;
  }

  return (
    role === 'member'
    && entry.userId === auth.user?.id
    && board.card?.assigneeId === auth.user?.id
  );
}

function canDeleteComment(userId: string): boolean {
  const role = board.current?.role;

  if (role === 'owner' || role === 'admin') {
    return true;
  }

  return userId === auth.user?.id;
}

const commentThreads = computed((): CommentThread[] => {
  const comments = board.card?.comments ?? [];
  const roots = comments.filter((item) => !item.parentId);
  const repliesByParent = new Map<string, CardComment[]>();

  for (const item of comments) {
    if (item.parentId) {
      const list = repliesByParent.get(item.parentId) ?? [];
      list.push(item);
      repliesByParent.set(item.parentId, list);
    }
  }

  return roots.map((root) => {
    const replies = repliesByParent.get(root.id) ?? [];

    return {
      root,
      items: [root, ...replies],
    };
  });
});

const commentPlaceholder = computed(() => (
  replyTo.value
    ? `Ответ для ${replyTo.value.displayName}…`
    : 'Напишите комментарий…'
));

function startReply(item: CardComment): void {
  cancelEditComment();
  replyTo.value = { id: item.id, displayName: item.displayName };
  void nextTick(() => {
    document.querySelector<HTMLInputElement>('.card-comment-input')?.focus();
  });
}

function cancelReply(): void {
  replyTo.value = null;
}

function canEditComment(userId: string): boolean {
  return userId === auth.user?.id;
}

function startEditComment(item: CardComment): void {
  cancelReply();
  editingCommentId.value = item.id;
  editingBody.value = item.body;
}

function cancelEditComment(): void {
  editingCommentId.value = null;
  editingBody.value = '';
}

async function saveEditComment(): Promise<void> {
  const id = editingCommentId.value;
  const body = editingBody.value.trim();

  if (!id || !body) {
    return;
  }

  await board.editComment(id, body);
  cancelEditComment();
}

function openHoursModal(): void {
  hours.value = 2;
  hoursWorkedAt.value = toDateInput(new Date());
  editingEntryId.value = null;
  hoursOpen.value = true;
}

function openEditHours(entry: TimeEntry): void {
  hours.value = entry.hours;
  hoursWorkedAt.value = toDateInput(entry.workedAt);
  editingEntryId.value = entry.id;
  hoursOpen.value = true;
}

async function submitHours(): Promise<void> {
  if (!board.card) {
    return;
  }

  if (editingEntryId.value) {
    await board.patchTimeEntry(editingEntryId.value, hours.value);
  } else {
    await board.logHours(
      board.card.id,
      hours.value,
      hoursWorkedAt.value || undefined,
    );
  }

  hoursOpen.value = false;
  editingEntryId.value = null;
}

async function removeTimeEntry(entryId: string): Promise<void> {
  await board.deleteTimeEntry(entryId);
}

async function removeComment(commentId: string): Promise<void> {
  await board.deleteComment(commentId);
}

async function removeCard(): Promise<void> {
  if (!cardToDelete.value) {
    return;
  }

  const deletedId = cardToDelete.value.id;
  const shouldCloseCard = board.card?.id === deletedId;
  await board.deleteCard(deletedId);
  cardDeleteOpen.value = false;
  cardToDelete.value = null;

  if (shouldCloseCard) {
    cardOpen.value = false;
  }
}

async function sendComment(): Promise<void> {
  if (!board.card || !comment.value.trim()) {
    return;
  }

  await board.addComment(board.card.id, comment.value, replyTo.value?.id);
  comment.value = '';
  replyTo.value = null;
}

async function saveLabels(): Promise<void> {
  if (!board.current) {
    return;
  }

  await board.addLabel(board.current.id, labelName.value, labelColor.value);
  labelName.value = '';
}

function labelDraftChanged(labelId: string, name: string): boolean {
  const draft = (labelDrafts.value[labelId] ?? '').trim();
  return Boolean(draft) && draft !== name;
}

async function saveLabelName(labelId: string): Promise<void> {
  if (!board.current) {
    return;
  }

  const name = (labelDrafts.value[labelId] ?? '').trim();
  const current = board.current.labels.find((item) => item.id === labelId);

  if (!current || !name || name === current.name) {
    return;
  }

  await board.patchLabel(board.current.id, labelId, name);
}
</script>

<template>
  <div>
    <p
      v-if="board.error"
      class="warn"
    >
      {{ board.error }}
    </p>
    <p
      v-else-if="!board.current"
      class="muted"
    >
      Загрузка…
    </p>
    <template v-if="board.current">
      <div class="board-toolbar">
        <div class="board-filters">
          <input
            v-model="filterQuery"
            class="input board-filter-search"
            type="search"
            placeholder="Поиск…"
          >
          <select
            v-model="filterAssignee"
            class="select board-filter-select"
          >
            <option value="">
              Все исполнители
            </option>
            <option value="none">
              Без исполнителя
            </option>
            <option
              v-for="row in project.current?.rates ?? []"
              :key="row.userId"
              :value="row.userId"
            >
              {{ row.displayName }}
            </option>
          </select>
          <div class="board-filter-labels">
            <select
              v-model="filterLabelId"
              class="select board-filter-select"
            >
              <option value="">
                Все метки
              </option>
              <option
                v-for="label in board.current.labels"
                :key="label.id"
                :value="label.id"
              >
                {{ label.name }}
              </option>
            </select>
            <button
              v-if="canAdmin"
              type="button"
              class="btn btn-ghost"
              @click="labelsOpen = true"
            >
              Управление
            </button>
          </div>
          <select
            v-if="showReleases"
            v-model="filterReleaseId"
            class="select board-filter-select"
          >
            <option value="">
              Все релизы
            </option>
            <option value="none">
              Без релиза
            </option>
            <option
              v-for="release in board.current.releases"
              :key="release.id"
              :value="release.id"
            >
              {{ release.name }}
            </option>
          </select>
          <button
            v-if="filtersActive"
            type="button"
            class="btn btn-ghost"
            @click="clearFilters"
          >
            Сбросить
          </button>
        </div>
      </div>
      <div class="columns">
        <div
          v-for="column in board.current.columns"
          :key="column.id"
          :class="['column', { 'is-drop-target': isForeignCardDrop(column.id) }]"
          @dragover="onColumnDragOver($event, column.id)"
          @drop="onDrop($event, column.id)"
        >
          <div
            class="column-head"
            :draggable="canAdmin && renamingId !== column.id"
            @dragstart="onColumnDragStart($event, column.id)"
            @dragend="onDragEnd"
          >
            <input
              v-if="renamingId === column.id"
              v-model="renameValue"
              class="column-title-input"
              type="text"
              placeholder="Название колонки…"
              @click.stop
              @keydown.enter.prevent="saveRename(column.id)"
              @keydown.escape.prevent="renamingId = null"
              @blur="saveRename(column.id)"
            >
            <h2
              v-else
              :class="{ 'is-editable': canAdmin }"
              @click="startRename(column)"
            >
              {{ column.name }}
            </h2>
            <span class="count">{{ visibleCardsOf(column.id).length }}</span>
            <button
              v-if="canAdmin"
              type="button"
              class="column-menu-btn"
              @click.stop="toggleMenu($event, column.id)"
            >
              ⋯
            </button>
          </div>
          <div class="column-cards">
            <template
              v-for="card in visibleCardsOf(column.id)"
              :key="card.id"
            >
              <div
                :class="[
                  'task',
                  {
                    'is-overdue': isOverdue(card.dueDate, column.isDone),
                    'is-dragging': dragCardId === card.id,
                    'is-drop-before':
                      cardDropEdge(column.id, card.id) === 'before',
                    'is-drop-after':
                      cardDropEdge(column.id, card.id) === 'after'
                  }
                ]"
                role="button"
                tabindex="0"
                draggable="true"
                @dragstart="onCardDragStart($event, card.id, column.id)"
                @dragover="onCardDragOver($event, column.id, card.id)"
                @dragend="onDragEnd"
                @click="openCard(card.id)"
                @keydown.enter.prevent="openCard(card.id)"
                @keydown.space.prevent="openCard(card.id)"
              >
                <button
                  v-if="canEdit"
                  type="button"
                  class="task-menu-btn"
                  aria-label="Действия карточки"
                  @click.stop="toggleCardMenu($event, card.id)"
                >
                  <svg
                    viewBox="0 0 16 16"
                    width="14"
                    height="14"
                    aria-hidden="true"
                  >
                    <circle
                      cx="3"
                      cy="8"
                      r="1.5"
                      fill="currentColor"
                    />
                    <circle
                      cx="8"
                      cy="8"
                      r="1.5"
                      fill="currentColor"
                    />
                    <circle
                      cx="13"
                      cy="8"
                      r="1.5"
                      fill="currentColor"
                    />
                  </svg>
                </button>
                <div class="labels">
                  <span
                    v-for="labelId in card.labelIds"
                    :key="labelId"
                    :class="labelClass(
                      board.current.labels.find((item) => item.id === labelId)?.color ?? 'blue',
                    )"
                  >
                    {{ board.current.labels.find((item) => item.id === labelId)?.name }}
                  </span>
                </div>
                <h3>{{ card.title }}</h3>
                <span
                  v-if="card.releaseName"
                  class="release-chip"
                >{{ card.releaseName }}</span>
                <div class="task-foot">
                  <div class="task-meta">
                    <UserAvatar
                      v-if="card.assigneeName"
                      class="sm"
                      :name="card.assigneeName"
                      :src="card.assigneeAvatarUrl ?? ''"
                    />
                    <span :class="{ 'is-overdue': isOverdue(card.dueDate, column.isDone) }">
                      {{ formatDate(card.dueDate) }}
                    </span>
                    <span
                      v-if="card.commentCount"
                      class="task-comments"
                    >
                      <svg
                        viewBox="0 0 16 16"
                        width="12"
                        height="12"
                        aria-hidden="true"
                      >
                        <path
                          fill="currentColor"
                          d="M2.5 2h11A1.5 1.5 0 0 1 15 3.5v6A1.5 1.5 0 0 1 13.5 11H8.4L5 14.2V11H2.5A1.5 1.5 0 0 1 1 9.5v-6A1.5 1.5 0 0 1 2.5 2z"
                        />
                      </svg>
                      {{ card.commentCount }}
                    </span>
                    <span
                      v-if="card.checklistTotal"
                      class="task-checklist"
                    >
                      <svg
                        viewBox="0 0 16 16"
                        width="12"
                        height="12"
                        aria-hidden="true"
                      >
                        <path
                          fill="currentColor"
                          d="M3.5 1.5A1.5 1.5 0 0 0 2 3v10a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 14 13V3a1.5 1.5 0 0 0-1.5-1.5h-9zm7.03 4.22 1.06 1.06-4.25 4.25L5.03 8.72l1.06-1.06 1.25 1.25 3.19-3.19z"
                        />
                      </svg>
                      {{ card.checklistDone }}/{{ card.checklistTotal }}
                    </span>
                  </div>
                </div>
              </div>
            </template>
            <div
              v-if="showEmptyDrop(column.id)"
              class="drop-placeholder"
              aria-hidden="true"
            />
            <p
              v-else-if="allCardsOf(column.id).length === 0"
              class="column-empty"
            >
              Нет задач
            </p>
            <p
              v-else-if="visibleCardsOf(column.id).length === 0"
              class="column-empty"
            >
              Нет совпадений
            </p>
          </div>
          <div
            v-if="canEdit"
            class="composer"
          >
            <template v-if="addingCardColumnId === column.id">
              <textarea
                v-model="newCardTitle"
                placeholder="Название карточки…"
                @keydown.enter.exact.prevent="submitCard(column.id)"
                @keydown.escape="cancelCardComposer"
              />
              <div class="composer-actions">
                <button
                  type="button"
                  class="btn"
                  @click="submitCard(column.id)"
                >
                  Добавить
                </button>
                <button
                  type="button"
                  class="icon-btn"
                  @click="cancelCardComposer"
                >
                  ×
                </button>
              </div>
            </template>
            <button
              v-else
              type="button"
              class="add-card-btn"
              @click="openCardComposer(column.id)"
            >
              + Добавить карточку
            </button>
          </div>
        </div>
        <div
          v-if="canAdmin"
          class="add-list"
        >
          <div
            v-if="addingColumn"
            class="composer"
          >
            <input
              v-model="newColumnName"
              class="input"
              type="text"
              placeholder="Название колонки…"
              @keydown.enter.prevent="submitColumn"
              @keydown.escape="cancelColumnComposer"
            >
            <div class="composer-actions">
              <button
                type="button"
                class="btn"
                @click="submitColumn"
              >
                Добавить колонку
              </button>
              <button
                type="button"
                class="icon-btn"
                @click="cancelColumnComposer"
              >
                ×
              </button>
            </div>
          </div>
          <button
            v-else
            type="button"
            class="add-list-btn"
            @click="openColumnComposer"
          >
            + Добавить колонку
          </button>
        </div>
      </div>

      <Teleport to="body">
        <div
          v-if="menuColumn && menuPosition"
          class="column-menu"
          :style="menuPosition"
          @click.stop
        >
          <button
            type="button"
            @click="startRename(menuColumn)"
          >
            Переименовать
          </button>
          <button
            type="button"
            class="is-danger"
            @click="openColumnDelete(menuColumn)"
          >
            Удалить
          </button>
        </div>
        <div
          v-else-if="menuCard && menuPosition"
          class="column-menu"
          :style="menuPosition"
          @click.stop
        >
          <button
            type="button"
            @click="copyCard(menuCard)"
          >
            Копировать
          </button>
          <button
            v-if="canDeleteBoardCard(menuCard)"
            type="button"
            class="is-danger"
            @click="openCardDelete(menuCard)"
          >
            Удалить
          </button>
        </div>
      </Teleport>

      <div
        class="overlay"
        :class="{ 'is-open': cardOpen }"
        @click.self="cardOpen = false"
      >
        <div
          v-if="board.card"
          class="card-modal"
          role="dialog"
          aria-modal="true"
          :aria-label="board.card.title"
        >
          <div class="card-modal-top">
            <div
              class="card-modal-list"
              :title="cardColumnName"
            >
              {{ cardColumnName || 'Колонка' }}
            </div>
            <div class="card-modal-top-actions">
              <button
                v-if="canDeleteCard"
                type="button"
                class="icon-btn is-danger"
                aria-label="Удалить карточку"
                @click="openCardDeleteFromModal"
              >
                <svg
                  viewBox="0 0 16 16"
                  width="16"
                  height="16"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M6 1.5h4l.75 1.5H14V4.5H2V3h3.25L6 1.5zM3.5 5.5h9l-.6 8.1A1.25 1.25 0 0 1 10.66 14.5H5.34a1.25 1.25 0 0 1-1.24-.9L3.5 5.5zm2.25 1.5v5.5h1.5V7h-1.5zm3 0v5.5h1.5V7h-1.5z"
                  />
                </svg>
              </button>
              <button
                type="button"
                class="icon-btn"
                aria-label="Закрыть"
                @click="cardOpen = false"
              >
                ×
              </button>
            </div>
          </div>

          <div class="card-modal-grid">
            <div class="card-modal-main">
              <div class="card-modal-title-wrap">
                <input
                  v-if="canEdit"
                  v-model="cardTitle"
                  class="input card-modal-title"
                  type="text"
                  placeholder="Название карточки…"
                  @keydown.enter.prevent="saveTitle"
                  @blur="saveTitle"
                >
                <h2
                  v-else
                  class="card-modal-title"
                >
                  {{ board.card.title }}
                </h2>
              </div>

              <div
                v-if="canEdit"
                class="card-actions"
              >
                <button
                  type="button"
                  class="card-action-btn"
                  @click="focusDueDateField"
                >
                  Даты
                </button>
                <button
                  type="button"
                  class="card-action-btn"
                  @click="addChecklist"
                >
                  <svg
                    viewBox="0 0 16 16"
                    width="14"
                    height="14"
                    aria-hidden="true"
                  >
                    <path
                      fill="currentColor"
                      d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z"
                    />
                  </svg>
                  Чек-лист
                </button>
                <button
                  v-if="canLogHours"
                  type="button"
                  class="card-action-btn"
                  @click="openHoursModal"
                >
                  <svg
                    viewBox="0 0 16 16"
                    width="14"
                    height="14"
                    aria-hidden="true"
                  >
                    <path
                      fill="currentColor"
                      d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z"
                    />
                  </svg>
                  Затраты
                </button>
                <button
                  type="button"
                  class="card-action-btn"
                  @click="focusAssigneeField"
                >
                  Участники
                </button>
              </div>

              <div class="field">
                <label>Метки</label>
                <div
                  v-if="board.current.labels.length"
                  class="label-picks"
                >
                  <button
                    v-for="label in board.current.labels"
                    :key="label.id"
                    type="button"
                    :class="[
                      labelClass(label.color),
                      { 'is-on': board.card.labelIds.includes(label.id) }
                    ]"
                    :disabled="!canEdit"
                    @click="toggleLabel(label.id)"
                  >
                    {{ label.name }}
                  </button>
                </div>
                <p
                  v-else
                  class="muted"
                >
                  Меток нет
                </p>
              </div>

              <div class="field-row">
                <div class="field">
                  <label>Исполнитель</label>
                  <select
                    ref="assigneeSelectRef"
                    class="select"
                    :value="board.card.assigneeId ?? ''"
                    :disabled="!canEdit"
                    @change="board.patchCard(board.card.id, {
                      assigneeId: ($event.target as HTMLSelectElement).value || null,
                    })"
                  >
                    <option value="">
                      Без исполнителя
                    </option>
                    <option
                      v-for="row in project.current?.rates ?? []"
                      :key="row.userId"
                      :value="row.userId"
                    >
                      {{ row.displayName }}
                    </option>
                  </select>
                </div>
                <div class="field">
                  <label>Срок</label>
                  <input
                    ref="dueDateInputRef"
                    class="input"
                    type="date"
                    :value="toDateInput(board.card.dueDate)"
                    :disabled="!canEdit"
                    @change="saveDueDate"
                  >
                </div>
              </div>

              <div class="field-row">
                <div class="field">
                  <label>Оценка (план), часы</label>
                  <input
                    class="input"
                    type="number"
                    min="0"
                    max="1000"
                    step="0.5"
                    :value="board.card.estimateHours"
                    :disabled="!canEdit"
                    @change="saveEstimate"
                  >
                </div>
                <div class="field">
                  <label>Потрачено</label>
                  <button
                    v-if="canLogHours"
                    type="button"
                    class="fake-input fake-input--action"
                    @click="openHoursModal"
                  >
                    {{ factHours }} ч
                  </button>
                  <div
                    v-else
                    class="fake-input"
                  >
                    {{ factHours }} ч
                  </div>
                </div>
              </div>

              <div
                v-if="showMoney"
                class="field"
              >
                <label>План / факт, ₽</label>
                <div class="fake-input">
                  {{ board.card.planAmount ?? '—' }} ₽
                  <template v-if="factAmount !== null">
                    · факт {{ factAmount }} ₽
                  </template>
                </div>
              </div>

              <div
                v-if="showReleases"
                class="field"
              >
                <label>Релиз</label>
                <select
                  class="select"
                  :value="board.card.releaseId ?? ''"
                  :disabled="!canEdit"
                  @change="saveRelease"
                >
                  <option value="">
                    Без релиза
                  </option>
                  <option
                    v-for="item in board.current.releases"
                    :key="item.id"
                    :value="item.id"
                  >
                    {{ item.name }}
                  </option>
                </select>
              </div>

              <div class="field desc-field">
                <div class="card-section-head">
                  <label>Описание</label>
                  <button
                    v-if="canEdit && !descEditing"
                    type="button"
                    class="btn btn-ghost"
                    @click="startEditDescription"
                  >
                    Изменить
                  </button>
                </div>
                <template v-if="canEdit && descEditing">
                  <textarea
                    v-model="descDraft"
                    class="input desc-input"
                    rows="5"
                    placeholder="Добавить более подробное описание…"
                  />
                  <div class="desc-actions">
                    <button
                      type="button"
                      class="btn"
                      @click="saveDescription"
                    >
                      Сохранить
                    </button>
                    <button
                      type="button"
                      class="btn btn-ghost"
                      @click="cancelDescription"
                    >
                      Отмена
                    </button>
                  </div>
                </template>
                <template v-else>
                  <div
                    ref="descBodyRef"
                    class="desc-view"
                    :class="{
                      'is-collapsed': Boolean(board.card.description) && !descExpanded,
                      'is-readonly': !canEdit
                    }"
                    :role="canEdit ? 'button' : undefined"
                    :tabindex="canEdit ? 0 : undefined"
                    @click="canEdit ? onDescriptionClick($event) : undefined"
                    @keydown.enter.prevent="canEdit ? startEditDescription() : undefined"
                  >
                    <!-- eslint-disable vue/no-v-html --><!-- escaped in linkifyText -->
                    <span
                      v-if="board.card.description"
                      class="desc-text"
                      v-html="linkifyText(board.card.description)"
                    />
                    <!-- eslint-enable vue/no-v-html -->
                    <span
                      v-else
                      class="muted"
                    >
                      {{ canEdit ? 'Добавить более подробное описание…' : 'Описания нет' }}
                    </span>
                  </div>
                  <button
                    v-if="descNeedsToggle"
                    type="button"
                    class="btn btn-ghost desc-toggle"
                    @click="toggleDescription"
                  >
                    {{ descExpanded ? 'Свернуть' : 'Читать полностью' }}
                  </button>
                </template>
              </div>

              <div
                v-for="list in board.card.checklists"
                :key="list.id"
                class="checklist"
              >
                <div class="checklist-head">
                  <input
                    v-if="canEdit"
                    v-model="checklistDrafts[list.id]"
                    class="input checklist-title"
                    type="text"
                    @keydown.enter.prevent="saveChecklistTitle(list.id)"
                    @blur="saveChecklistTitle(list.id)"
                  >
                  <h3 v-else>
                    {{ list.title }}
                  </h3>
                  <button
                    v-if="canEdit"
                    type="button"
                    class="btn btn-ghost"
                    @click="board.deleteChecklist(list.id)"
                  >
                    Удалить
                  </button>
                </div>
                <div class="checklist-progress">
                  <span>
                    {{ checklistDoneCount(list) }}/{{ list.items.length }}
                  </span>
                  <div class="progress-track">
                    <div
                      class="progress-fill"
                      :class="{ 'is-done': checklistPercent(list) === 100 }"
                      :style="{ width: `${checklistPercent(list)}%` }"
                    />
                  </div>
                </div>
                <div
                  v-for="item in list.items"
                  :key="item.id"
                  class="check-item"
                  :class="{ 'is-done': item.done }"
                >
                  <input
                    type="checkbox"
                    :checked="item.done"
                    :disabled="!canEdit"
                    @change="toggleItem(item.id, ($event.target as HTMLInputElement).checked)"
                  >
                  <input
                    v-if="canEdit"
                    v-model="itemDrafts[item.id]"
                    class="input check-item-text"
                    type="text"
                    @keydown.enter.prevent="saveItemText(item.id)"
                    @blur="saveItemText(item.id)"
                  >
                  <span v-else>{{ item.text }}</span>
                  <button
                    v-if="canEdit"
                    type="button"
                    class="btn btn-ghost"
                    @click="board.deleteChecklistItem(item.id)"
                  >
                    Удалить
                  </button>
                </div>
                <input
                  v-if="canEdit"
                  v-model="newItemText[list.id]"
                  class="input mt-8"
                  type="text"
                  placeholder="Добавить пункт"
                  @keydown.enter.prevent="addItem(list.id)"
                >
              </div>
              <button
                v-if="canEdit"
                type="button"
                class="btn btn-ghost checklist-add"
                @click="addChecklist"
              >
                Добавить чеклист
              </button>

              <div class="costs">
                <div class="card-section-head">
                  <label>Затраты</label>
                  <span class="costs-total">{{ factHours }} ч</span>
                </div>
                <div
                  v-if="board.card.timeEntries.length"
                  class="costs-table"
                >
                  <div class="costs-row costs-row--head">
                    <span>Дата</span>
                    <span>Пользователь</span>
                    <span>Время</span>
                    <span
                      class="costs-actions"
                      aria-hidden="true"
                    />
                  </div>
                  <div
                    v-for="entry in board.card.timeEntries"
                    :key="entry.id"
                    class="costs-row"
                  >
                    <span>{{ formatDate(entry.workedAt) }}</span>
                    <span class="costs-user">{{ entry.displayName }}</span>
                    <span>{{ entry.hours }} ч</span>
                    <div class="costs-actions row-actions">
                      <template v-if="canManageEntry(entry)">
                        <button
                          type="button"
                          class="btn btn-ghost"
                          @click="openEditHours(entry)"
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          class="btn btn-ghost"
                          @click="removeTimeEntry(entry.id)"
                        >
                          Удалить
                        </button>
                      </template>
                    </div>
                  </div>
                </div>
                <div
                  v-else
                  class="costs-empty"
                >
                  <p class="muted">
                    Затрат пока нет
                  </p>
                  <button
                    v-if="canLogHours"
                    type="button"
                    class="btn btn-ghost"
                    @click="openHoursModal"
                  >
                    Списать часы
                  </button>
                </div>
              </div>
            </div>

            <div class="card-modal-side">
              <div class="card-section-head">
                <label>Комментарии</label>
              </div>
              <div
                v-if="replyTo"
                class="comment-reply-chip"
              >
                <span>Ответ для {{ replyTo.displayName }}</span>
                <button
                  type="button"
                  class="btn btn-ghost"
                  @click="cancelReply"
                >
                  Отмена
                </button>
              </div>
              <input
                v-if="canEdit"
                v-model="comment"
                class="input card-comment-input"
                :placeholder="commentPlaceholder"
                @keydown.enter="sendComment"
              >
              <div class="card-comments">
                <template
                  v-for="thread in commentThreads"
                  :key="thread.root.id"
                >
                  <div
                    v-for="item in thread.items"
                    :key="item.id"
                    class="comment"
                    :class="{ 'comment--reply': Boolean(item.parentId) }"
                  >
                    <div class="comment-head">
                      <div class="who">
                        <UserAvatar
                          class="sm"
                          :name="item.displayName"
                          :src="item.avatarUrl"
                        />
                        {{ item.displayName }}
                        <span
                          v-if="item.editedAt"
                          class="comment-edited"
                        >изменён</span>
                      </div>
                      <div
                        v-if="editingCommentId !== item.id"
                        class="comment-actions"
                      >
                        <button
                          v-if="canEdit"
                          type="button"
                          class="btn btn-ghost"
                          @click="startReply(item)"
                        >
                          Ответить
                        </button>
                        <button
                          v-if="canEditComment(item.userId)"
                          type="button"
                          class="btn btn-ghost"
                          @click="startEditComment(item)"
                        >
                          Изменить
                        </button>
                        <button
                          v-if="canDeleteComment(item.userId)"
                          type="button"
                          class="btn btn-ghost"
                          @click="removeComment(item.id)"
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                    <div
                      v-if="item.parentId"
                      class="comment-reply-to"
                    >
                      в ответ {{ thread.root.displayName }}
                    </div>
                    <div
                      v-if="editingCommentId === item.id"
                      class="comment-edit"
                    >
                      <textarea
                        v-model="editingBody"
                        class="input comment-edit-input"
                        rows="3"
                        @keydown.escape.prevent="cancelEditComment"
                      />
                      <div class="comment-edit-actions">
                        <button
                          type="button"
                          class="btn btn-ghost"
                          @click="cancelEditComment"
                        >
                          Отмена
                        </button>
                        <button
                          type="button"
                          class="btn"
                          :disabled="!editingBody.trim()"
                          @click="saveEditComment"
                        >
                          Сохранить
                        </button>
                      </div>
                    </div>
                    <div v-else>
                      {{ item.body }}
                    </div>
                  </div>
                </template>
                <p
                  v-if="commentThreads.length === 0"
                  class="muted"
                >
                  Комментариев пока нет
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ModalDialog
        :open="hoursOpen"
        :title="editingEntryId ? 'Изменить списание' : 'Списать часы'"
        @close="hoursOpen = false"
      >
        <div class="field">
          <label>Часы</label>
          <input
            v-model.number="hours"
            class="input"
            type="number"
            min="0.5"
            max="24"
            step="0.5"
            placeholder="0.5"
          >
        </div>
        <div
          v-if="!editingEntryId"
          class="field"
        >
          <label>Дата</label>
          <input
            v-model="hoursWorkedAt"
            class="input"
            type="date"
          >
        </div>
        <div class="modal-foot">
          <button
            type="button"
            class="btn btn-ghost"
            @click="hoursOpen = false"
          >
            Отмена
          </button>
          <button
            type="button"
            class="btn"
            @click="submitHours"
          >
            {{ editingEntryId ? 'Сохранить' : 'Списать' }}
          </button>
        </div>
      </ModalDialog>

      <ModalDialog
        :open="labelsOpen"
        title="Метки"
        @close="labelsOpen = false"
      >
        <div
          v-for="label in board.current.labels"
          :key="label.id"
          class="label-row"
        >
          <span
            :class="labelClass(label.color)"
            class="label-row-swatch"
          />
          <input
            v-model="labelDrafts[label.id]"
            class="input"
            type="text"
            :aria-label="`Название метки ${label.name}`"
          >
          <button
            type="button"
            class="btn btn-ghost"
            :disabled="!labelDraftChanged(label.id, label.name)"
            @click="saveLabelName(label.id)"
          >
            Сохранить
          </button>
          <button
            type="button"
            class="btn btn-ghost"
            @click="board.deleteLabel(board.current!.id, label.id)"
          >
            Удалить
          </button>
        </div>
        <div class="field-row mt-16">
          <div class="field">
            <label>Новая метка</label>
            <input
              v-model="labelName"
              class="input"
              type="text"
              placeholder="Название метки…"
            >
          </div>
          <div class="field">
            <label>Цвет</label>
            <select
              v-model="labelColor"
              class="select"
            >
              <option value="blue">
                Синий
              </option>
              <option value="green">
                Зелёный
              </option>
              <option value="purple">
                Фиолетовый
              </option>
              <option value="pink">
                Розовый
              </option>
              <option value="amber">
                Янтарный
              </option>
            </select>
          </div>
        </div>
        <div class="modal-foot">
          <button
            type="button"
            class="btn"
            @click="saveLabels"
          >
            Добавить метку
          </button>
        </div>
      </ModalDialog>

      <ModalDialog
        :open="cardDeleteOpen"
        title="Удалить карточку"
        @close="cardDeleteOpen = false; cardToDelete = null"
      >
        <p class="muted mb-16">
          «{{ cardToDelete?.title }}» будет удалена. Действие нельзя отменить.
        </p>
        <div class="modal-foot">
          <button
            type="button"
            class="btn btn-ghost"
            @click="cardDeleteOpen = false; cardToDelete = null"
          >
            Отмена
          </button>
          <button
            type="button"
            class="btn btn-danger"
            @click="removeCard"
          >
            Удалить
          </button>
        </div>
      </ModalDialog>

      <ModalDialog
        :open="columnDeleteOpen"
        title="Удалить колонку"
        @close="columnDeleteOpen = false"
      >
        <p class="muted mb-16">
          <template v-if="columnHasCards">
            Сначала переместите карточки
          </template>
          <template v-else>
            Удалить колонку «{{ columnToDelete?.name }}»?
          </template>
        </p>
        <div class="modal-foot">
          <button
            type="button"
            class="btn btn-ghost"
            @click="columnDeleteOpen = false"
          >
            Отмена
          </button>
          <button
            type="button"
            class="btn btn-danger"
            :disabled="columnHasCards"
            @click="removeColumn"
          >
            Удалить
          </button>
        </div>
      </ModalDialog>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.board-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 16px;
}

.board-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.board-filter-search {
  width: 180px;
  min-width: 140px;
}

.board-filter-select {
  width: auto;
  min-width: 140px;
  max-width: 180px;
}

.board-filter-labels {
  display: flex;
  align-items: center;
  gap: 4px;
}

.columns {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  align-items: flex-start;
  padding-bottom: 8px;
}

.column {
  flex: 0 0 272px;
  width: 272px;
  max-height: calc(100vh - var(--header-h) - 200px);
  min-height: 120px;
  display: flex;
  flex-direction: column;
  padding: 8px;
  background: var(--column);
  border: 0;
  border-radius: var(--radius-lg);

  &.is-drop-target {
    outline: 2px solid var(--blue);
    outline-offset: -2px;
    background: var(--selected);
  }
}

.column-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  padding: 4px 6px;
  flex-shrink: 0;

  h2 {
    flex: 1;
    margin: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    font-weight: 600;

    &.is-editable {
      cursor: pointer;
    }
  }
}

.column-title-input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--blue);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  background: var(--surface);
  font-size: 14px;
  font-weight: 600;
}

.column-cards {
  flex: 1;
  overflow-y: auto;
  min-height: 8px;
  padding-bottom: 2px;
}

.column-empty {
  margin: 8px 0;
  padding: 16px 8px;
  color: var(--muted);
  font-size: 13px;
  text-align: center;
}

.drop-placeholder {
  min-height: 48px;
  margin-bottom: 8px;
  border: 2px dashed var(--blue);
  border-radius: var(--radius);
  background: var(--blue-soft);
  pointer-events: none;
}

.count {
  min-width: 20px;
  height: 20px;
  border-radius: 4px;
  background: var(--selected);
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.composer {
  flex-shrink: 0;
  margin-top: 4px;

  textarea {
    width: 100%;
    min-height: 54px;
    resize: none;
    border: 0;
    border-radius: var(--radius);
    padding: 8px 10px;
    background: var(--surface);
    box-shadow: var(--shadow);

    &:focus {
      outline: none;
      border-color: var(--blue);
    }
  }
}

.composer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.add-card-btn,
.add-list-btn {
  width: 100%;
  border: 0;
  border-radius: var(--radius);
  padding: 6px 8px;
  background: transparent;
  color: var(--muted);
  text-align: left;

  &:hover {
    background: var(--hover);
    color: var(--text);
  }
}

.add-list {
  flex: 0 0 272px;
  width: 272px;
  padding: 8px;
  background: rgb(255 255 255 / 20%);
  border-radius: var(--radius-lg);

  .add-list-btn {
    color: #fff;

    &:hover {
      background: rgb(255 255 255 / 16%);
      color: #fff;
    }
  }

  .icon-btn {
    color: #fff;

    &:hover {
      background: rgb(255 255 255 / 16%);
      color: #fff;
    }
  }

  .composer {
    margin-top: 0;
  }
}

.task {
  position: relative;
  display: block;
  width: 100%;
  margin-bottom: 8px;
  padding: 8px 10px 10px;
  text-align: left;
  border: 0;
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow);
  color: inherit;
  cursor: pointer;

  &:hover {
    background: var(--surface);
    box-shadow: var(--shadow-hover);
  }

  &:has(.task-menu-btn) {
    padding-right: 28px;
  }

  &.is-dragging {
    opacity: 0.4;
  }

  &.is-drop-before::before,
  &.is-drop-after::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    height: 4px;
    border-radius: 2px;
    background: var(--blue);
    pointer-events: none;
    z-index: 1;
  }

  &.is-drop-before::before {
    top: -6px;
  }

  &.is-drop-after::after {
    bottom: -6px;
  }

  &.is-overdue {
    box-shadow: inset 0 0 0 2px var(--danger), var(--shadow);
    background: var(--surface);

    &:hover {
      box-shadow: inset 0 0 0 2px var(--danger), var(--shadow-hover);
      background: var(--surface);
    }
  }

  h3 {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 500;
  }

  .label {
    border-radius: 4px;
    padding: 1px 6px;
    line-height: 1.4;
  }
}

.task-menu-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--muted);
  line-height: 0;
  opacity: 0;
  cursor: pointer;

  &:hover {
    background: var(--hover);
    color: var(--text);
  }
}

.task:hover .task-menu-btn,
.task:focus-within .task-menu-btn,
.task-menu-btn:focus {
  opacity: 1;
}

@media (hover: none) {
  .task-menu-btn {
    opacity: 1;
  }
}

.task-foot {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  color: var(--muted);
  font-size: 12px;

  .is-overdue {
    color: var(--danger);
    font-weight: 600;
  }
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  width: 100%;

  > span {
    white-space: nowrap;
  }
}

.task-comments,
.task-checklist {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}

.labels {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;

  &:empty {
    display: none;
  }
}

.label {
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: 500;
}

.label-blue {
  background: #0079bf;
  color: #fff;
}

.label-green {
  background: #61bd4f;
  color: #fff;
}

.label-purple {
  background: #c377e0;
  color: #fff;
}

.label-pink {
  background: #ff78cb;
  color: #fff;
}

.label-amber {
  background: #f2d600;
  color: #172b4d;
}

.release-chip {
  display: inline-block;
  margin-bottom: 6px;
  border-radius: 4px;
  padding: 1px 6px;
  background: #ebecf0;
  color: #5e6c84;
  font-size: 11px;
  font-weight: 500;
}

.overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 40;
  place-items: center;
  padding: 24px 16px;
  background: rgb(0 0 0 / 64%);
  overflow: auto;

  &.is-open {
    display: grid;
  }
}

.card-modal {
  --bg: #1d2125;
  --surface: #22272b;
  --border: #a6c5e229;
  --text: #c7d1db;
  --muted: #9fadbc;
  --hover: #a1bdd914;
  --column: #a1bdd914;
  --input-bg: #22272b;
  --selected: #1c2b41;
  --blue: #579dff;
  --blue-hover: #85b8ff;
  --blue-soft: #579dff3d;
  --primary: #579dff;
  --primary-hover: #85b8ff;
  --danger: #f87168;
  --danger-soft: #42221f;
  --green: #4bce97;
  --green-soft: #1c3329;
  color-scheme: dark;
  display: flex;
  flex-direction: column;
  width: min(920px, 100%);
  max-height: calc(100vh - 48px);
  overflow: hidden;
  color: var(--text);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 12px 48px rgb(0 0 0 / 55%);

  .input.card-modal-title {
    background: transparent;
    border-color: transparent;

    &:focus {
      background: var(--bg);
      border-color: var(--blue);
      box-shadow: 0 0 0 2px var(--blue-soft);
    }
  }

  .btn-ghost {
    color: var(--muted);

    &:hover:not(:disabled) {
      color: var(--text);
      background: var(--hover);
    }
  }

  .btn-danger:hover:not(:disabled) {
    background: #5d2a26;
  }

  .input:focus,
  .select:focus {
    background: var(--bg);
  }

  .check-item-text:focus {
    background: var(--bg);
  }

  .icon-btn {
    color: var(--muted);

    &:hover {
      background: var(--hover);
      color: var(--text);
    }
  }
}

.card-modal-top {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px 0;
}

.card-modal-list {
  max-width: 60%;
  overflow: hidden;
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-modal-top-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
}

.card-modal-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(240px, 1fr);
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.card-modal-main,
.card-modal-side {
  min-height: 0;
  overflow: auto;
  padding: 16px 20px 24px;
}

.card-modal-side {
  border-left: 1px solid var(--border);
  background: var(--bg);
}

.card-modal-title-wrap {
  margin-bottom: 12px;
}

.card-modal-title {
  width: 100%;
  height: auto;
  margin: 0;
  padding: 4px 8px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.3;
  color: var(--text);
}

h2.card-modal-title {
  padding-left: 0;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.card-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--column);
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    background: #a6c5e229;
  }
}

.card-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;

  label {
    margin-bottom: 0;
  }

  .btn {
    height: auto;
    padding: 2px 8px;
    font-size: 12px;
  }
}

.card-comment-input {
  margin-bottom: 12px;
}

.comment-reply-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  background: var(--hover);
  color: var(--muted);
  font-size: 12px;

  .btn {
    height: auto;
    padding: 2px 8px;
    font-size: 12px;
  }
}

.card-comments {
  display: flex;
  flex-direction: column;
}

.fake-input {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 36px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--input-bg);
  color: inherit;
  font: inherit;
  font-size: 14px;
  text-align: left;

  &--action {
    cursor: pointer;

    &:hover {
      border-color: var(--blue);
      background: var(--hover);
    }

    &:focus-visible {
      outline: none;
      border-color: var(--blue);
      box-shadow: 0 0 0 2px var(--blue-soft);
    }
  }
}

.comment {
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  font-size: 14px;

  &:last-child {
    border-bottom: 0;
  }

  .who {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 13px;
  }
}

.comment--reply {
  margin-left: 16px;
  padding-left: 12px;
  border-left: 2px solid var(--border);
}

.comment-reply-to {
  margin-bottom: 4px;
  color: var(--muted);
  font-size: 12px;
}

.comment-edited {
  font-weight: 400;
  font-size: 12px;
  color: var(--muted);
}

.comment-edit {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comment-edit-input {
  min-height: 72px;
  resize: vertical;
}

.comment-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.comment-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;

  .btn {
    height: auto;
    padding: 2px 8px;
    font-size: 12px;
  }
}

.comment-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.label-picks {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  button {
    border: 1px solid transparent;
    cursor: pointer;
    opacity: 0.45;

    &.is-on {
      opacity: 1;
      box-shadow: inset 0 0 0 1px currentColor;
    }

    &:disabled {
      cursor: default;
    }
  }
}

.desc-input {
  height: auto;
  min-height: 96px;
  padding: 8px 10px;
  resize: vertical;
  line-height: 1.45;
}

.desc-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.desc-view {
  display: block;
  width: 100%;
  min-height: 36px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: var(--input-bg);
  color: inherit;
  text-align: left;
  cursor: pointer;

  &.is-collapsed {
    max-height: 100px;
    overflow: hidden;
  }

  &:hover:not(:disabled):not(.is-readonly) {
    background: var(--hover);
  }

  &.is-readonly {
    cursor: default;
    background: transparent;
    padding-left: 0;
  }
}

.desc-toggle {
  height: auto;
  margin-top: 4px;
  padding: 2px 8px;
  font-size: 12px;
}

.desc-field {
  margin-bottom: 32px;
}

.desc-text {
  white-space: pre-wrap;
  word-break: break-word;

  :deep(a) {
    color: var(--blue);
    text-decoration: underline;
    word-break: break-all;

    &:hover {
      color: var(--blue-hover);
    }
  }
}

.checklist {
  margin-bottom: 20px;
}

.checklist-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;

  h3 {
    flex: 1;
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }
}

.checklist-title {
  flex: 1;
  height: 32px;
  font-weight: 600;
}

.checklist-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--muted);
  font-size: 12px;
}

.progress-track {
  flex: 1;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--border);
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--blue);

  &.is-done {
    background: var(--green);
  }
}

.check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;

  &.is-done .check-item-text,
  &.is-done > span {
    color: var(--muted);
    text-decoration: line-through;
  }
}

.check-item-text {
  flex: 1;
  height: 32px;
  border-color: transparent;
  background: transparent;

  &:focus {
    border-color: var(--blue);
    background: var(--surface);
  }
}

.checklist-add {
  margin-bottom: 24px;
}

.costs {
  margin-bottom: 8px;
}

.costs-empty {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  .muted {
    margin: 0;
  }
}

.costs-total {
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}

.costs-table {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.costs-row {
  display: grid;
  grid-template-columns: 130px minmax(0, 1fr) 56px 148px;
  gap: 8px;
  align-items: center;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;

  &:last-child {
    border-bottom: 0;
  }

  &--head {
    background: var(--bg);
    color: var(--muted);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  > :nth-child(3) {
    white-space: nowrap;
  }
}

.costs-user {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.costs-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  min-height: 24px;
  min-width: 0;
}

.label-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);

  &:last-of-type {
    border-bottom: 0;
  }

  .input {
    flex: 1;
    min-width: 0;
    width: auto;
  }
}

.label-row-swatch {
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  padding: 0;
}

@media (max-width: 800px) {
  .card-modal {
    max-height: calc(100vh - 32px);
    overflow: auto;
  }

  .card-modal-grid {
    grid-template-columns: 1fr;
    overflow: visible;
  }

  .card-modal-main,
  .card-modal-side {
    overflow: visible;
  }

  .card-modal-side {
    border-left: 0;
    border-top: 1px solid var(--border);
  }
}
</style>
