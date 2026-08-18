import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  http, errorMessage, toastError, toastSuccess,
} from '../api/http.ts';
import type {
  BoardDetails,
  CardDetails,
  LabelColor,
  ReleaseDetails,
} from '../types/index.ts';
import { useProjectStore } from './project.ts';

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
  const error = ref<string | null>(null);
  let fetchSeq = 0;

  function reset(): void {
    current.value = null;
    error.value = null;
  }

  function syncReleaseCaches(): void {
    const details = release.value;
    const projects = useProjectStore();

    if (details && projects.current?.id === details.projectId) {
      projects.current = {
        ...projects.current,
        releases: projects.current.releases.map((item) => (
          item.id === details.id
            ? {
              ...item,
              name: details.name,
              date: details.date,
              status: details.status,
              cardCount: details.cards.length,
            }
            : item
        )),
      };
    }

    if (details && current.value) {
      current.value = {
        ...current.value,
        releases: current.value.releases.map((item) => (
          item.id === details.id
            ? { ...item, name: details.name, status: details.status }
            : item
        )),
      };
    }
  }

  function removeReleaseFromCaches(releaseId: string): void {
    const projects = useProjectStore();

    if (projects.current) {
      projects.current = {
        ...projects.current,
        releases: projects.current.releases.filter(
          (item) => item.id !== releaseId,
        ),
      };
    }

    if (current.value) {
      current.value = {
        ...current.value,
        releases: current.value.releases.filter(
          (item) => item.id !== releaseId,
        ),
      };
    }

    if (release.value?.id === releaseId) {
      release.value = null;
    }
  }

  async function fetchBoard(boardId: string): Promise<void> {
    fetchSeq += 1;
    const seq = fetchSeq;
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
    error.value = null;

    try {
      await http.post('/cards', payload);
      await fetchBoard(payload.boardId);
      toastSuccess('Карточка создана');
    } catch (err: unknown) {
      error.value = errorMessage(err);
      toastError('Ошибка при создании карточки', err);
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
    try {
      await http.patch(`/cards/${cardId}`, patch);
      await refreshCardAndBoard(cardId);
      toastSuccess('Карточка обновлена');
    } catch (err: unknown) {
      toastError('Ошибка при обновлении карточки', err);
      throw err;
    }
  }

  async function deleteCard(cardId: string): Promise<void> {
    try {
      await http.delete(`/cards/${cardId}`);
      card.value = null;

      if (current.value) {
        await fetchBoard(current.value.id);
      }

      toastSuccess('Карточка удалена');
    } catch (err: unknown) {
      toastError('Ошибка при удалении карточки', err);
      throw err;
    }
  }

  async function moveCard(
    cardId: string,
    columnId: string,
    position: number,
  ): Promise<void> {
    try {
      await http.patch(`/cards/${cardId}`, { columnId, position });
    } catch (err: unknown) {
      toastError('Ошибка при перемещении карточки', err);
      throw err;
    }
  }

  async function logHours(
    cardId: string,
    hours: number,
    workedAt?: string,
  ): Promise<void> {
    try {
      await http.post(`/cards/${cardId}/time-entries`, {
        hours,
        ...(workedAt ? { workedAt } : {}),
      });
      await refreshCardAndBoard(cardId);
      toastSuccess('Часы списаны');
    } catch (err: unknown) {
      toastError('Ошибка при списании часов', err);
      throw err;
    }
  }

  async function patchTimeEntry(entryId: string, hours: number): Promise<void> {
    try {
      await http.patch(`/cards/time-entries/${entryId}`, { hours });
      await refreshCardAndBoard();
      toastSuccess('Списание обновлено');
    } catch (err: unknown) {
      toastError('Ошибка при обновлении списания', err);
      throw err;
    }
  }

  async function deleteTimeEntry(entryId: string): Promise<void> {
    try {
      await http.delete(`/cards/time-entries/${entryId}`);
      await refreshCardAndBoard();
      toastSuccess('Списание удалено');
    } catch (err: unknown) {
      toastError('Ошибка при удалении списания', err);
      throw err;
    }
  }

  async function addComment(
    cardId: string,
    body: string,
    parentId?: string,
  ): Promise<void> {
    try {
      await http.post(`/cards/${cardId}/comments`, {
        body,
        ...(parentId ? { parentId } : {}),
      });
      await fetchCard(cardId);
      toastSuccess('Комментарий добавлен');
    } catch (err: unknown) {
      toastError('Ошибка при добавлении комментария', err);
      throw err;
    }
  }

  async function editComment(commentId: string, body: string): Promise<void> {
    try {
      await http.patch(`/cards/comments/${commentId}`, { body });

      if (card.value) {
        await fetchCard(card.value.id);
      }

      toastSuccess('Комментарий обновлён');
    } catch (err: unknown) {
      toastError('Ошибка при изменении комментария', err);
      throw err;
    }
  }

  async function deleteComment(commentId: string): Promise<void> {
    try {
      await http.delete(`/cards/comments/${commentId}`);

      if (card.value) {
        await fetchCard(card.value.id);
      }

      toastSuccess('Комментарий удалён');
    } catch (err: unknown) {
      toastError('Ошибка при удалении комментария', err);
      throw err;
    }
  }

  async function addChecklist(cardId: string, title?: string): Promise<void> {
    try {
      await http.post(`/cards/${cardId}/checklists`, title ? { title } : {});
      await refreshCardAndBoard(cardId);
      toastSuccess('Чеклист создан');
    } catch (err: unknown) {
      toastError('Ошибка при создании чеклиста', err);
      throw err;
    }
  }

  async function renameChecklist(
    checklistId: string,
    title: string,
  ): Promise<void> {
    try {
      await http.patch(`/cards/checklists/${checklistId}`, { title });
      await refreshCardAndBoard();
      toastSuccess('Чеклист обновлён');
    } catch (err: unknown) {
      toastError('Ошибка при обновлении чеклиста', err);
      throw err;
    }
  }

  async function deleteChecklist(checklistId: string): Promise<void> {
    try {
      await http.delete(`/cards/checklists/${checklistId}`);
      await refreshCardAndBoard();
      toastSuccess('Чеклист удалён');
    } catch (err: unknown) {
      toastError('Ошибка при удалении чеклиста', err);
      throw err;
    }
  }

  async function addChecklistItem(
    checklistId: string,
    text: string,
  ): Promise<void> {
    try {
      await http.post(`/cards/checklists/${checklistId}/items`, { text });
      await refreshCardAndBoard();
      toastSuccess('Пункт добавлен');
    } catch (err: unknown) {
      toastError('Ошибка при добавлении пункта', err);
      throw err;
    }
  }

  async function patchChecklistItem(
    itemId: string,
    patch: { text?: string; done?: boolean },
  ): Promise<void> {
    try {
      await http.patch(`/cards/checklist-items/${itemId}`, patch);
      await refreshCardAndBoard();
      toastSuccess('Пункт обновлён');
    } catch (err: unknown) {
      toastError('Ошибка при обновлении пункта', err);
      throw err;
    }
  }

  async function deleteChecklistItem(itemId: string): Promise<void> {
    try {
      await http.delete(`/cards/checklist-items/${itemId}`);
      await refreshCardAndBoard();
      toastSuccess('Пункт удалён');
    } catch (err: unknown) {
      toastError('Ошибка при удалении пункта', err);
      throw err;
    }
  }

  async function addLabel(
    boardId: string,
    name: string,
    color: LabelColor,
  ): Promise<void> {
    try {
      await http.post(`/boards/${boardId}/labels`, { name, color });
      await fetchBoard(boardId);
      toastSuccess('Метка создана');
    } catch (err: unknown) {
      toastError('Ошибка при создании метки', err);
      throw err;
    }
  }

  async function patchLabel(
    boardId: string,
    labelId: string,
    name: string,
  ): Promise<void> {
    try {
      await http.patch(`/boards/labels/${labelId}`, { name });
      await fetchBoard(boardId);
      toastSuccess('Метка обновлена');
    } catch (err: unknown) {
      toastError('Ошибка при переименовании метки', err);
      throw err;
    }
  }

  async function deleteLabel(boardId: string, labelId: string): Promise<void> {
    try {
      await http.delete(`/boards/labels/${labelId}`);
      await fetchBoard(boardId);
      toastSuccess('Метка удалена');
    } catch (err: unknown) {
      toastError('Ошибка при удалении метки', err);
      throw err;
    }
  }

  async function addColumn(boardId: string, name: string): Promise<void> {
    error.value = null;

    try {
      await http.post(`/boards/${boardId}/columns`, { name });
      await fetchBoard(boardId);
      toastSuccess('Колонка создана');
    } catch (err: unknown) {
      error.value = errorMessage(err);
      toastError('Ошибка при создании колонки', err);
    }
  }

  async function patchColumn(
    columnId: string,
    patch: { name?: string; position?: number },
  ): Promise<void> {
    error.value = null;

    try {
      await http.patch(`/boards/columns/${columnId}`, patch);

      if (current.value) {
        await fetchBoard(current.value.id);
      }

      toastSuccess('Колонка обновлена');
    } catch (err: unknown) {
      error.value = errorMessage(err);
      toastError('Ошибка при обновлении колонки', err);
    }
  }

  async function reorderColumns(orderedIds: string[]): Promise<void> {
    error.value = null;

    try {
      await Promise.all(
        orderedIds.map((id, position) => http.patch(`/boards/columns/${id}`, { position })),
      );

      if (current.value) {
        await fetchBoard(current.value.id);
      }

      toastSuccess('Колонки обновлены');
    } catch (err: unknown) {
      error.value = errorMessage(err);
      toastError('Ошибка при обновлении колонок', err);
    }
  }

  async function deleteColumn(columnId: string): Promise<void> {
    error.value = null;

    try {
      await http.delete(`/boards/columns/${columnId}`);

      if (current.value) {
        await fetchBoard(current.value.id);
      }

      toastSuccess('Колонка удалена');
    } catch (err: unknown) {
      error.value = errorMessage(err);
      toastError('Ошибка при удалении колонки', err);
    }
  }

  async function fetchRelease(releaseId: string): Promise<void> {
    error.value = null;

    try {
      const { data } = await http.get<ReleaseDetails>(`/releases/${releaseId}`);
      release.value = data;
    } catch (err: unknown) {
      error.value = errorMessage(err);
    }
  }

  async function setReleaseStatus(
    releaseId: string,
    status: 'planned' | 'released',
  ): Promise<void> {
    try {
      await http.patch(`/releases/${releaseId}`, { status });
      await fetchRelease(releaseId);
      syncReleaseCaches();
      toastSuccess('Статус релиза обновлён');
    } catch (err: unknown) {
      toastError('Ошибка при обновлении статуса', err);
      throw err;
    }
  }

  async function updateRelease(
    releaseId: string,
    payload: { name?: string; date?: string | null },
  ): Promise<boolean> {
    error.value = null;

    try {
      await http.patch(`/releases/${releaseId}`, payload);
      await fetchRelease(releaseId);
      syncReleaseCaches();
      toastSuccess('Релиз обновлён');
      return true;
    } catch (err: unknown) {
      error.value = errorMessage(err);
      toastError('Ошибка при обновлении релиза', err);
      return false;
    }
  }

  async function attachCard(
    releaseId: string,
    cardIds: string[],
  ): Promise<void> {
    try {
      await Promise.all(
        cardIds.map((cardId) => http.post(`/releases/${releaseId}/cards`, { cardId })),
      );

      await fetchRelease(releaseId);
      syncReleaseCaches();
      toastSuccess('Карточки прикреплены');
    } catch (err: unknown) {
      toastError('Ошибка при прикреплении карточек', err);
      throw err;
    }
  }

  async function detachCard(releaseId: string, cardId: string): Promise<void> {
    try {
      await http.delete(`/releases/${releaseId}/cards/${cardId}`);
      await fetchRelease(releaseId);
      syncReleaseCaches();
      toastSuccess('Карточка откреплена');
    } catch (err: unknown) {
      toastError('Ошибка при откреплении карточки', err);
      throw err;
    }
  }

  async function deleteRelease(releaseId: string): Promise<void> {
    try {
      await http.delete(`/releases/${releaseId}`);
      removeReleaseFromCaches(releaseId);
      toastSuccess('Релиз удалён');
    } catch (err: unknown) {
      toastError('Ошибка при удалении релиза', err);
      throw err;
    }
  }

  return {
    current,
    card,
    release,
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
    editComment,
    deleteComment,
    addChecklist,
    renameChecklist,
    deleteChecklist,
    addChecklistItem,
    patchChecklistItem,
    deleteChecklistItem,
    addLabel,
    patchLabel,
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
    deleteRelease,
  };
});
