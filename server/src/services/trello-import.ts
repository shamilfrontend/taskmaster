import mongoose from 'mongoose';
import { AppError } from '../errors/app-error.js';
import { BoardModel } from '../models/board.js';
import { CardModel } from '../models/card.js';
import { ColumnModel } from '../models/column.js';
import { LabelModel } from '../models/label.js';
import { ProjectModel } from '../models/project.js';
import {
  DEFAULT_BOARD_NAME,
  DEFAULT_ROLE_RATES,
  type LabelColor,
} from '../constants.js';
import { deleteProjectCascade } from './cascade.js';

const DESCRIPTION_MAX = 8000;
const CHECKLIST_TITLE_MAX = 200;
const CHECKLIST_ITEM_MAX = 500;
const CARD_BATCH = 100;

const TRELLO_COLOR: Record<string, LabelColor> = {
  blue: 'blue',
  green: 'green',
  purple: 'purple',
  pink: 'pink',
  yellow: 'amber',
  orange: 'amber',
  red: 'pink',
  sky: 'blue',
  lime: 'green',
};

interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
  pos: number;
}

interface TrelloLabel {
  id: string;
  name: string;
  color: string | null;
}

interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  closed: boolean;
  idList: string;
  idLabels: string[];
  pos: number;
}

interface TrelloCheckItem {
  name: string;
  state: string;
  pos: number;
}

interface TrelloChecklist {
  idCard: string;
  name: string;
  pos: number;
  checkItems: TrelloCheckItem[];
}

interface TrelloBoard {
  name: string;
  lists: TrelloList[];
  cards: TrelloCard[];
  labels: TrelloLabel[];
  checklists: TrelloChecklist[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clip(value: string, max: number): string {
  const trimmed = value.trim();

  if (trimmed.length <= max) {
    return trimmed;
  }

  return trimmed.slice(0, max);
}

function fallbackName(value: string): string {
  return value.trim() || 'Без названия';
}

function mapColor(raw: string | null): LabelColor {
  const base = (raw ?? '').split('_')[0] ?? '';
  return TRELLO_COLOR[base] ?? 'purple';
}

function parseDue(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function parseList(value: unknown): TrelloList | null {
  const row = asRecord(value);

  if (!row || typeof row.id !== 'string' || !row.id) {
    return null;
  }

  return {
    id: row.id,
    name: fallbackName(asString(row.name)),
    closed: row.closed === true,
    pos: asNumber(row.pos),
  };
}

function parseLabel(value: unknown): TrelloLabel | null {
  const row = asRecord(value);

  if (!row || typeof row.id !== 'string' || !row.id) {
    return null;
  }

  return {
    id: row.id,
    name: fallbackName(asString(row.name)),
    color: typeof row.color === 'string' ? row.color : null,
  };
}

function parseCard(value: unknown): TrelloCard | null {
  const row = asRecord(value);

  if (!row || typeof row.id !== 'string' || !row.id) {
    return null;
  }

  if (typeof row.idList !== 'string' || !row.idList) {
    return null;
  }

  const idLabels = Array.isArray(row.idLabels)
    ? row.idLabels.filter((id): id is string => typeof id === 'string')
    : [];

  return {
    id: row.id,
    name: fallbackName(asString(row.name)),
    desc: asString(row.desc),
    due: typeof row.due === 'string' ? row.due : null,
    closed: row.closed === true,
    idList: row.idList,
    idLabels,
    pos: asNumber(row.pos),
  };
}

function parseCheckItem(value: unknown): TrelloCheckItem | null {
  const row = asRecord(value);

  if (!row) {
    return null;
  }

  const name = clip(asString(row.name), CHECKLIST_ITEM_MAX);

  if (!name) {
    return null;
  }

  return {
    name,
    state: asString(row.state),
    pos: asNumber(row.pos),
  };
}

function parseChecklist(value: unknown): TrelloChecklist | null {
  const row = asRecord(value);

  if (!row || typeof row.idCard !== 'string' || !row.idCard) {
    return null;
  }

  const checkItems = Array.isArray(row.checkItems)
    ? row.checkItems
      .map(parseCheckItem)
      .filter((item): item is TrelloCheckItem => item !== null)
      .sort((a, b) => a.pos - b.pos)
    : [];

  return {
    idCard: row.idCard,
    name: fallbackName(clip(asString(row.name), CHECKLIST_TITLE_MAX)),
    pos: asNumber(row.pos),
    checkItems,
  };
}

function parseBoard(value: unknown): TrelloBoard {
  const row = asRecord(value);

  if (!row || !Array.isArray(row.lists) || !Array.isArray(row.cards)) {
    throw new AppError(400, 'Это не экспорт доски Trello');
  }

  return {
    name: fallbackName(asString(row.name)),
    lists: row.lists
      .map(parseList)
      .filter((item): item is TrelloList => item !== null),
    cards: row.cards
      .map(parseCard)
      .filter((item): item is TrelloCard => item !== null),
    labels: Array.isArray(row.labels)
      ? row.labels
        .map(parseLabel)
        .filter((item): item is TrelloLabel => item !== null)
      : [],
    checklists: Array.isArray(row.checklists)
      ? row.checklists
        .map(parseChecklist)
        .filter((item): item is TrelloChecklist => item !== null)
      : [],
  };
}

export async function importTrelloBoard(params: {
  teamId: mongoose.Types.ObjectId;
  name: string;
  board: unknown;
}): Promise<{ id: string; name: string }> {
  const parsed = parseBoard(params.board);
  const lists = parsed.lists
    .filter((list) => !list.closed)
    .sort((a, b) => a.pos - b.pos);

  if (lists.length === 0) {
    throw new AppError(400, 'В файле нет активных колонок');
  }

  const openListIds = new Set(lists.map((list) => list.id));
  const cards = parsed.cards
    .filter((card) => !card.closed && openListIds.has(card.idList))
    .sort((a, b) => a.pos - b.pos);
  const importedCardIds = new Set(cards.map((card) => card.id));
  const checklistsByCard = new Map<string, TrelloChecklist[]>();

  for (const checklist of parsed.checklists) {
    if (importedCardIds.has(checklist.idCard)) {
      const bucket = checklistsByCard.get(checklist.idCard) ?? [];
      bucket.push(checklist);
      checklistsByCard.set(checklist.idCard, bucket);
    }
  }

  for (const bucket of checklistsByCard.values()) {
    bucket.sort((a, b) => a.pos - b.pos);
  }

  let projectId: mongoose.Types.ObjectId | null = null;

  try {
    const project = await ProjectModel.create({
      teamId: params.teamId,
      name: params.name,
      budgetLimit: 0,
      roleRates: DEFAULT_ROLE_RATES,
      releasesEnabled: false,
      budgetEnabled: false,
    });

    projectId = project._id;

    const board = await BoardModel.create({
      projectId: project._id,
      name: DEFAULT_BOARD_NAME,
    });

    const columnIdByList = new Map<string, mongoose.Types.ObjectId>();
    const columns = lists.map((list, index) => {
      const id = new mongoose.Types.ObjectId();
      columnIdByList.set(list.id, id);

      return {
        _id: id,
        boardId: board._id,
        name: list.name,
        position: index,
        isDone: false,
      };
    });

    await ColumnModel.insertMany(columns);

    const labelIdByTrello = new Map<string, mongoose.Types.ObjectId>();
    const labels = parsed.labels.map((label) => {
      const id = new mongoose.Types.ObjectId();
      labelIdByTrello.set(label.id, id);

      return {
        _id: id,
        boardId: board._id,
        name: label.name,
        color: mapColor(label.color),
      };
    });

    if (labels.length > 0) {
      await LabelModel.insertMany(labels);
    }

    const positionByColumn = new Map<string, number>();
    const cardDocs = cards.flatMap((card) => {
      const columnId = columnIdByList.get(card.idList);

      if (!columnId) {
        return [];
      }

      const columnKey = columnId.toString();
      const position = positionByColumn.get(columnKey) ?? 0;
      positionByColumn.set(columnKey, position + 1);

      const checklists = (checklistsByCard.get(card.id) ?? []).map(
        (checklist, checklistIndex) => ({
          title: checklist.name,
          position: checklistIndex,
          items: checklist.checkItems.map((item, itemIndex) => ({
            text: item.name,
            done: item.state === 'complete',
            position: itemIndex,
          })),
        }),
      );

      return [
        {
          boardId: board._id,
          columnId,
          title: card.name,
          description: clip(card.desc, DESCRIPTION_MAX),
          assigneeId: null,
          dueDate: parseDue(card.due),
          estimateHours: 0,
          releaseId: null,
          labelIds: card.idLabels
            .map((id) => labelIdByTrello.get(id))
            .filter((id): id is mongoose.Types.ObjectId => Boolean(id)),
          checklists,
          position,
          planAmount: 0,
        },
      ];
    });

    for (let index = 0; index < cardDocs.length; index += CARD_BATCH) {
      // Sequential batches keep Mongo memory bounded.
      // eslint-disable-next-line no-await-in-loop
      await CardModel.insertMany(cardDocs.slice(index, index + CARD_BATCH));
    }

    return { id: project._id.toString(), name: project.name };
  } catch (err) {
    if (projectId) {
      try {
        await deleteProjectCascade(projectId);
      } catch (rollbackErr) {
        console.error(rollbackErr);
      }
    }

    throw err;
  }
}
