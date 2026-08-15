import { defineStore } from 'pinia';
import { ref } from 'vue';
import { http, errorMessage } from '../api/http.ts';
import type {
  BoardDetails,
  CardDetails,
  LabelColor,
  ReleaseDetails
} from '../types/index.ts';

interface CardPatch {
  title?: string;
  description?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  estimateHours?: number;
  releaseId?: string | null;
  labelIds?: string[];
}

export const useBoardStore = defineStore('board', () => {
  const current = ref<BoardDetails | null>(null);
  const card = ref<CardDetails | null>(null);
  const release = ref<ReleaseDetails | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  let fetchSeq = 0;

  function reset(): void {
    current.value = null;
    error.value = null;
  }

  async function fetchBoard(boardId: string): Promise<void> {
    const seq = ++fetchSeq;
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await http.get<BoardDetails>(`/boards/${boardId}`);

      if (seq !== fetchSeq) {
        return;
      }

      current.value = data;
    } catch (err: unknown) {
      if (seq !== fetchSeq) {
        return;
      }

      error.value = errorMessage(err);
    } finally {
      if (seq === fetchSeq) {
        isLoading.value = false;
      }
    }
  }

  function syncCommentCount(cardId: string, count: number): void {
    const item = current.value?.cards.find((boardCard) => boardCard.id === cardId);

    if (item) {
      item.commentCount = count;
    }
  }

  async function fetchCard(cardId: string): Promise<void> {
    const { data } = await http.get<CardDetails>(`/cards/${cardId}`);
    card.value = data;
    syncCommentCount(cardId, data.comments.length);
  }

  async function createCard(payload: {
    boardId: string;
    columnId: string;
    title: string;
    assigneeId?: string;
    dueDate?: string;
    estimateHours?: number;
    releaseId?: string;
    labelIds?: string[];
  }): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      await http.post('/cards', payload);
      await fetchBoard(payload.boardId);
    } catch (err: unknown) {
      error.value = errorMessage(err);
    } finally {
      isLoading.value = false;
    }
  }

  async function refreshCardAndBoard(cardId?: string): Promise<void> {
    const id = cardId ?? card.value?.id;

    if (id) {
      await fetchCard(id);
    }

    if (current.value) {
      await fetchBoard(current.value.id);
    }
  }

  async function patchCard(cardId: string, patch: CardPatch): Promise<void> {
    await http.patch(`/cards/${cardId}`, patch);
    await refreshCardAndBoard(cardId);
  }

  async function deleteCard(cardId: string): Promise<void> {
    await http.delete(`/cards/${cardId}`);
    card.value = null;

    if (current.value) {
      await fetchBoard(current.value.id);
    }
  }

  async function moveCard(
    cardId: string,
    columnId: string,
    position: number
  ): Promise<void> {
    await http.patch(`/cards/${cardId}`, { columnId, position });
  }

  async function logHours(
    cardId: string,
    hours: number,
    workedAt?: string
  ): Promise<void> {
    await http.post(`/cards/${cardId}/time-entries`, {
      hours,
      ...(workedAt ? { workedAt } : {})
    });
    await refreshCardAndBoard(cardId);
  }

  async function patchTimeEntry(entryId: string, hours: number): Promise<void> {
    await http.patch(`/cards/time-entries/${entryId}`, { hours });
    await refreshCardAndBoard();
  }

  async function deleteTimeEntry(entryId: string): Promise<void> {
    await http.delete(`/cards/time-entries/${entryId}`);
    await refreshCardAndBoard();
  }

  async function addComment(cardId: string, body: string): Promise<void> {
    await http.post(`/cards/${cardId}/comments`, { body });
    await fetchCard(cardId);
  }

  async function deleteComment(commentId: string): Promise<void> {
    await http.delete(`/cards/comments/${commentId}`);

    if (card.value) {
      await fetchCard(card.value.id);
    }
  }

  async function addChecklist(cardId: string, title?: string): Promise<void> {
    await http.post(`/cards/${cardId}/checklists`, title ? { title } : {});
    await refreshCardAndBoard(cardId);
  }

  async function renameChecklist(
    checklistId: string,
    title: string
  ): Promise<void> {
    await http.patch(`/cards/checklists/${checklistId}`, { title });
    await refreshCardAndBoard();
  }

  async function deleteChecklist(checklistId: string): Promise<void> {
    await http.delete(`/cards/checklists/${checklistId}`);
    await refreshCardAndBoard();
  }

  async function addChecklistItem(
    checklistId: string,
    text: string
  ): Promise<void> {
    await http.post(`/cards/checklists/${checklistId}/items`, { text });
    await refreshCardAndBoard();
  }

  async function patchChecklistItem(
    itemId: string,
    patch: { text?: string; done?: boolean }
  ): Promise<void> {
    await http.patch(`/cards/checklist-items/${itemId}`, patch);
    await refreshCardAndBoard();
  }

  async function deleteChecklistItem(itemId: string): Promise<void> {
    await http.delete(`/cards/checklist-items/${itemId}`);
    await refreshCardAndBoard();
  }

  async function addLabel(
    boardId: string,
    name: string,
    color: LabelColor
  ): Promise<void> {
    await http.post(`/boards/${boardId}/labels`, { name, color });
    await fetchBoard(boardId);
  }

  async function deleteLabel(boardId: string, labelId: string): Promise<void> {
    await http.delete(`/boards/labels/${labelId}`);
    await fetchBoard(boardId);
  }

  async function addColumn(boardId: string, name: string): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      await http.post(`/boards/${boardId}/columns`, { name });
      await fetchBoard(boardId);
    } catch (err: unknown) {
      error.value = errorMessage(err);
    } finally {
      isLoading.value = false;
    }
  }

  async function patchColumn(
    columnId: string,
    patch: { name?: string; position?: number }
  ): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      await http.patch(`/boards/columns/${columnId}`, patch);

      if (current.value) {
        await fetchBoard(current.value.id);
      }
    } catch (err: unknown) {
      error.value = errorMessage(err);
    } finally {
      isLoading.value = false;
    }
  }

  async function reorderColumns(orderedIds: string[]): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      await Promise.all(
        orderedIds.map((id, position) =>
          http.patch(`/boards/columns/${id}`, { position })
        )
      );

      if (current.value) {
        await fetchBoard(current.value.id);
      }
    } catch (err: unknown) {
      error.value = errorMessage(err);
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteColumn(columnId: string): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      await http.delete(`/boards/columns/${columnId}`);

      if (current.value) {
        await fetchBoard(current.value.id);
      }
    } catch (err: unknown) {
      error.value = errorMessage(err);
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchRelease(releaseId: string): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await http.get<ReleaseDetails>(`/releases/${releaseId}`);
      release.value = data;
    } catch (err: unknown) {
      error.value = errorMessage(err);
    } finally {
      isLoading.value = false;
    }
  }

  async function setReleaseStatus(
    releaseId: string,
    status: 'planned' | 'released'
  ): Promise<void> {
    await http.patch(`/releases/${releaseId}`, { status });
    await fetchRelease(releaseId);
  }

  async function updateRelease(
    releaseId: string,
    payload: { name?: string; date?: string | null }
  ): Promise<boolean> {
    error.value = null;

    try {
      await http.patch(`/releases/${releaseId}`, payload);
      await fetchRelease(releaseId);
      return true;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      return false;
    }
  }

  async function attachCard(releaseId: string, cardId: string): Promise<void> {
    await http.post(`/releases/${releaseId}/cards`, { cardId });
    await fetchRelease(releaseId);
  }

  async function detachCard(releaseId: string, cardId: string): Promise<void> {
    await http.delete(`/releases/${releaseId}/cards/${cardId}`);
    await fetchRelease(releaseId);
  }

  async function deleteRelease(releaseId: string): Promise<void> {
    await http.delete(`/releases/${releaseId}`);
  }

  return {
    current,
    card,
    release,
    isLoading,
    error,
    reset,
    fetchBoard,
    fetchCard,
    createCard,
    patchCard,
    deleteCard,
    moveCard,
    logHours,
    patchTimeEntry,
    deleteTimeEntry,
    addComment,
    deleteComment,
    addChecklist,
    renameChecklist,
    deleteChecklist,
    addChecklistItem,
    patchChecklistItem,
    deleteChecklistItem,
    addLabel,
    deleteLabel,
    addColumn,
    patchColumn,
    reorderColumns,
    deleteColumn,
    fetchRelease,
    setReleaseStatus,
    updateRelease,
    attachCard,
    detachCard,
    deleteRelease
  };
});
