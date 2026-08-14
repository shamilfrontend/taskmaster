import { defineStore } from 'pinia';
import { ref } from 'vue';
import { http, errorMessage } from '../api/http.ts';
import type {
  BoardDetails,
  CardDetails,
  LabelColor,
  ReleaseDetails
} from '../types/index.ts';

export const useBoardStore = defineStore('board', () => {
  const current = ref<BoardDetails | null>(null);
  const card = ref<CardDetails | null>(null);
  const release = ref<ReleaseDetails | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function fetchBoard(boardId: string): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const { data } = await http.get<BoardDetails>(`/boards/${boardId}`);
      current.value = data;
    } catch (err: unknown) {
      error.value = errorMessage(err);
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchCard(cardId: string): Promise<void> {
    const { data } = await http.get<CardDetails>(`/cards/${cardId}`);
    card.value = data;
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

  async function patchCard(
    cardId: string,
    patch: Record<string, unknown>
  ): Promise<void> {
    await http.patch(`/cards/${cardId}`, patch);

    if (current.value) {
      await fetchBoard(current.value.id);
    }

    await fetchCard(cardId);
  }

  async function moveCard(
    cardId: string,
    columnId: string,
    position: number
  ): Promise<void> {
    await http.patch(`/cards/${cardId}`, { columnId, position });
  }

  async function logHours(cardId: string, hours: number): Promise<void> {
    await http.post(`/cards/${cardId}/time-entries`, { hours });
    await fetchCard(cardId);

    if (current.value) {
      await fetchBoard(current.value.id);
    }
  }

  async function addComment(cardId: string, body: string): Promise<void> {
    await http.post(`/cards/${cardId}/comments`, { body });
    await fetchCard(cardId);
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
    await http.post(`/boards/${boardId}/columns`, { name });
    await fetchBoard(boardId);
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

  async function attachCard(releaseId: string, cardId: string): Promise<void> {
    await http.post(`/releases/${releaseId}/cards`, { cardId });
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
    fetchBoard,
    fetchCard,
    createCard,
    patchCard,
    moveCard,
    logHours,
    addComment,
    addLabel,
    deleteLabel,
    addColumn,
    fetchRelease,
    setReleaseStatus,
    attachCard,
    deleteRelease
  };
});
