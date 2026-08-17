import { Router } from 'express';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../errors/app-error.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import {
  requireMembership,
  teamIdFromBoard,
  teamIdFromCard,
} from '../middleware/access.js';
import { BoardModel } from '../models/board.js';
import { CardModel, type CardPojo, type ChecklistPojo } from '../models/card.js';
import { ColumnModel } from '../models/column.js';
import { CommentModel } from '../models/comment.js';
import { LabelModel } from '../models/label.js';
import { ProjectModel } from '../models/project.js';
import { ReleaseModel } from '../models/release.js';
import { TimeEntryModel } from '../models/time-entry.js';
import { UserModel } from '../models/user.js';
import { recordActivity } from '../services/activity.js';
import { rateForUser, recalcCardPlan } from '../services/plan.js';
import { calcAmount } from '../utils/rates.js';
import {
  asObjectId,
  assertFeatureOn,
  assertRole,
  isFeatureOn,
  readBoolean,
  readEstimate,
  readHours,
  readOptionalDate,
  readOptionalString,
  readString,
} from '../utils/validate.js';
import type { TeamRole } from '../constants.js';

const DESCRIPTION_MAX = 8000;
const CHECKLIST_TITLE_MAX = 200;
const CHECKLIST_ITEM_MAX = 500;
const ACTIVITY_DETAIL_MAX = 120;

function truncateDetail(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length <= ACTIVITY_DETAIL_MAX) {
    return trimmed;
  }

  return `${trimmed.slice(0, ACTIVITY_DETAIL_MAX - 1)}…`;
}

export const cardsRouter = Router();
cardsRouter.use(requireAuth);

function assertMaxLength(value: string, field: string, max: number): string {
  if (value.length > max) {
    throw new AppError(400, `Поле ${field} слишком длинное`);
  }

  return value;
}

function mapChecklists(checklists: ChecklistPojo[] | undefined) {
  return [...(checklists ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((list) => ({
      id: String(list._id),
      title: list.title,
      position: list.position,
      items: [...list.items]
        .sort((a, b) => a.position - b.position)
        .map((item) => ({
          id: String(item._id),
          text: item.text,
          done: item.done,
          position: item.position,
        })),
    }));
}

async function requireEditableCard(
  req: Request,
  cardId: string,
): Promise<mongoose.HydratedDocument<CardPojo>> {
  const teamId = await teamIdFromCard(cardId);
  const membership = await requireMembership(teamId, req.userId);

  if (!canEditCards(membership.role)) {
    throw new AppError(403, 'Недостаточно прав');
  }

  const card = await CardModel.findById(asObjectId(cardId));

  if (!card) {
    throw new AppError(404, 'Карточка не найдена');
  }

  return card;
}

async function findCardByChecklist(checklistId: string): Promise<{
  card: mongoose.HydratedDocument<CardPojo>;
  checklist: ChecklistPojo;
}> {
  const id = asObjectId(checklistId, 'checklistId');
  const card = await CardModel.findOne({ 'checklists._id': id });

  if (!card) {
    throw new AppError(404, 'Чеклист не найден');
  }

  const checklist = card.checklists.find((list) => list._id?.equals(id));

  if (!checklist) {
    throw new AppError(404, 'Чеклист не найден');
  }

  return { card, checklist };
}

async function findCardByItem(itemId: string): Promise<{
  card: mongoose.HydratedDocument<CardPojo>;
  checklist: ChecklistPojo;
  item: ChecklistPojo['items'][number];
}> {
  const id = asObjectId(itemId, 'itemId');
  const card = await CardModel.findOne({ 'checklists.items._id': id });

  if (!card) {
    throw new AppError(404, 'Пункт не найден');
  }

  for (const list of card.checklists) {
    const item = list.items.find((row) => row._id?.equals(id));

    if (item) {
      return { card, checklist: list, item };
    }
  }

  throw new AppError(404, 'Пункт не найден');
}

function canEditCards(role: TeamRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'member';
}

function canLogOnCard(
  role: TeamRole,
  assigneeId: string | null,
  userId: string,
): boolean {
  if (role === 'owner' || role === 'admin') {
    return true;
  }

  return role === 'member' && assigneeId === userId;
}

cardsRouter.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const boardId = readString(req.body, 'boardId');
    const teamId = await teamIdFromBoard(boardId);
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin', 'member']);

    const board = await BoardModel.findById(asObjectId(boardId)).lean();

    if (!board) {
      throw new AppError(404, 'Доска не найдена');
    }

    const columnId = readString(req.body, 'columnId');
    const column = await ColumnModel.findOne({
      _id: asObjectId(columnId, 'columnId'),
      boardId: board._id,
    }).lean();

    if (!column) {
      throw new AppError(400, 'Колонка не принадлежит доске');
    }

    const last = await CardModel.findOne({ columnId: column._id })
      .sort({ position: -1 })
      .lean();

    const assigneeRaw = readOptionalString(req.body, 'assigneeId');
    const releaseRaw = readOptionalString(req.body, 'releaseId');
    const estimateHours = req.body?.estimateHours === undefined || req.body?.estimateHours === ''
      ? 0
      : readEstimate(req.body, 'estimateHours');

    const card = await CardModel.create({
      boardId: board._id,
      columnId: column._id,
      title: readString(req.body, 'title'),
      description: '',
      assigneeId: assigneeRaw ? asObjectId(assigneeRaw, 'assigneeId') : null,
      dueDate: readOptionalDate(req.body, 'dueDate') ?? null,
      estimateHours,
      releaseId: releaseRaw ? asObjectId(releaseRaw, 'releaseId') : null,
      labelIds: [],
      checklists: [],
      position: (last?.position ?? -1) + 1,
      planAmount: 0,
    });

    if (Array.isArray(req.body?.labelIds)) {
      const ids = (req.body.labelIds as unknown[])
        .filter((id): id is string => typeof id === 'string')
        .map((id) => asObjectId(id, 'labelId'));
      const labels = await LabelModel.find({
        _id: { $in: ids },
        boardId: board._id,
      }).lean();
      card.labelIds = labels.map((label) => label._id);
      await card.save();
    }

    if (card.releaseId) {
      const project = await ProjectModel.findById(board.projectId).lean();

      if (!project) {
        throw new AppError(404, 'Проект не найден');
      }

      assertFeatureOn(project.releasesEnabled, 'Релизы выключены в проекте');

      const release = await ReleaseModel.findOne({
        _id: card.releaseId,
        projectId: board.projectId,
      }).lean();

      if (!release) {
        throw new AppError(400, 'Релиз не принадлежит проекту');
      }
    }

    await recalcCardPlan(card._id);
    const fresh = await CardModel.findById(card._id).lean();

    recordActivity({
      teamId,
      projectId: board.projectId,
      boardId: board._id,
      cardId: card._id,
      actorId: req.userId,
      kind: 'card_created',
      cardTitle: card.title,
      detail: column.name,
    });

    res.status(201).json({
      id: card._id.toString(),
      title: card.title,
      planAmount: fresh?.planAmount ?? 0,
    });
  }),
);

cardsRouter.get(
  '/:cardId',
  asyncHandler(async (req: Request, res: Response) => {
    const cardId = req.params.cardId as string;
    const teamId = await teamIdFromCard(cardId);
    const membership = await requireMembership(teamId, req.userId);
    const card = await CardModel.findById(asObjectId(cardId)).lean();

    if (!card) {
      throw new AppError(404, 'Карточка не найдена');
    }

    const entries = await TimeEntryModel.find({ cardId: card._id })
      .sort({ workedAt: 1 })
      .lean();
    const comments = await CommentModel.find({ cardId: card._id })
      .sort({ createdAt: 1 })
      .lean();
    const userIds = [
      ...entries.map((entry) => entry.userId),
      ...comments.map((comment) => comment.userId),
      ...(card.assigneeId ? [card.assigneeId] : []),
    ];
    const users = await UserModel.find({ _id: { $in: userIds } }).lean();
    const userById = (id: mongoose.Types.ObjectId) => (
      users.find((user) => user._id.toString() === id.toString())
    );
    const userName = (id: mongoose.Types.ObjectId): string => (
      userById(id)?.displayName ?? ''
    );
    const userAvatar = (id: mongoose.Types.ObjectId): string => (
      userById(id)?.avatarUrl ?? ''
    );

    const board = await BoardModel.findById(card.boardId).lean();
    const project = board
      ? await ProjectModel.findById(board.projectId).lean()
      : null;
    const budgetEnabled = isFeatureOn(project?.budgetEnabled);
    const isOwn = card.assigneeId?.toString() === req.userId;
    const showAllMoney = budgetEnabled
      && (membership.role === 'owner' || membership.role === 'admin');
    const showOwnMoney = budgetEnabled && membership.role === 'member' && isOwn;

    res.json({
      id: card._id.toString(),
      boardId: card.boardId.toString(),
      columnId: card.columnId.toString(),
      title: card.title,
      description: card.description ?? '',
      assigneeId: card.assigneeId?.toString() ?? null,
      dueDate: card.dueDate,
      estimateHours: card.estimateHours,
      releaseId: card.releaseId?.toString() ?? null,
      labelIds: card.labelIds.map((id) => id.toString()),
      checklists: mapChecklists(card.checklists),
      planAmount: showAllMoney || showOwnMoney ? card.planAmount : undefined,
      timeEntries: entries.map((entry) => {
        const own = entry.userId.toString() === req.userId;
        const showMoney = budgetEnabled
          && (showAllMoney || (membership.role === 'member' && own));

        return {
          id: entry._id.toString(),
          userId: entry.userId.toString(),
          displayName: userName(entry.userId),
          hours: entry.hours,
          rateSnapshot: showMoney ? entry.rateSnapshot : undefined,
          amount: showMoney ? entry.amount : undefined,
          workedAt: entry.workedAt,
        };
      }),
      comments: comments.map((comment) => ({
        id: comment._id.toString(),
        userId: comment.userId.toString(),
        displayName: userName(comment.userId),
        avatarUrl: userAvatar(comment.userId),
        body: comment.body,
        createdAt: comment.createdAt,
      })),
    });
  }),
);

cardsRouter.patch(
  '/:cardId',
  asyncHandler(async (req: Request, res: Response) => {
    const cardId = req.params.cardId as string;
    const teamId = await teamIdFromCard(cardId);
    const membership = await requireMembership(teamId, req.userId);

    if (!canEditCards(membership.role)) {
      throw new AppError(403, 'Недостаточно прав');
    }

    const card = await CardModel.findById(asObjectId(cardId));

    if (!card) {
      throw new AppError(404, 'Карточка не найдена');
    }

    const board = await BoardModel.findById(card.boardId).lean();

    if (!board) {
      throw new AppError(404, 'Доска не найдена');
    }

    const title = readOptionalString(req.body, 'title');

    if (title) {
      card.title = title;
    }

    if ('description' in (req.body as object)) {
      const raw = (req.body as Record<string, unknown>).description;

      if (typeof raw !== 'string') {
        throw new AppError(400, 'Поле description должно быть строкой');
      }

      card.description = assertMaxLength(raw.trim(), 'description', DESCRIPTION_MAX);
    }

    const previousColumnId = card.columnId.toString();
    let movedToColumnName: string | null = null;

    if (req.body?.columnId) {
      const column = await ColumnModel.findOne({
        _id: asObjectId(String(req.body.columnId), 'columnId'),
        boardId: card.boardId,
      }).lean();

      if (!column) {
        throw new AppError(400, 'Колонка не принадлежит доске');
      }

      if (column._id.toString() !== previousColumnId) {
        movedToColumnName = column.name;
      }

      card.columnId = column._id;
    }

    if (typeof req.body?.position === 'number') {
      card.position = req.body.position;
    }

    if ('assigneeId' in (req.body as object)) {
      const raw = req.body.assigneeId;
      card.assigneeId = typeof raw === 'string' && raw ? asObjectId(raw, 'assigneeId') : null;
    }

    if ('dueDate' in (req.body as object)) {
      card.dueDate = readOptionalDate(req.body, 'dueDate') ?? null;
    }

    if ('estimateHours' in (req.body as object)) {
      card.estimateHours = readEstimate(req.body, 'estimateHours');
    }

    if ('releaseId' in (req.body as object)) {
      const raw = req.body.releaseId;

      if (typeof raw === 'string' && raw) {
        const project = await ProjectModel.findById(board.projectId).lean();

        if (!project) {
          throw new AppError(404, 'Проект не найден');
        }

        assertFeatureOn(project.releasesEnabled, 'Релизы выключены в проекте');

        const release = await ReleaseModel.findOne({
          _id: asObjectId(raw, 'releaseId'),
          projectId: board.projectId,
        }).lean();

        if (!release) {
          throw new AppError(400, 'Релиз не принадлежит проекту');
        }

        card.releaseId = release._id;
      } else {
        card.releaseId = null;
      }
    }

    if (Array.isArray(req.body?.labelIds)) {
      const ids = (req.body.labelIds as unknown[])
        .filter((id): id is string => typeof id === 'string')
        .map((id) => asObjectId(id, 'labelId'));
      const labels = await LabelModel.find({
        _id: { $in: ids },
        boardId: card.boardId,
      }).lean();
      card.labelIds = labels.map((label) => label._id);
    }

    await card.save();
    await recalcCardPlan(card._id);

    if (movedToColumnName) {
      recordActivity({
        teamId,
        projectId: board.projectId,
        boardId: card.boardId,
        cardId: card._id,
        actorId: req.userId,
        kind: 'card_moved',
        cardTitle: card.title,
        detail: movedToColumnName,
      });
    }

    res.json({ ok: true });
  }),
);

cardsRouter.delete(
  '/:cardId',
  asyncHandler(async (req: Request, res: Response) => {
    const cardId = req.params.cardId as string;
    const teamId = await teamIdFromCard(cardId);
    const membership = await requireMembership(teamId, req.userId);
    const card = await CardModel.findById(asObjectId(cardId)).lean();

    if (!card) {
      throw new AppError(404, 'Карточка не найдена');
    }

    const entryCount = await TimeEntryModel.countDocuments({
      cardId: card._id,
    });

    if (entryCount > 0) {
      assertRole(membership.role, ['owner', 'admin']);
    } else {
      assertRole(membership.role, ['owner', 'admin', 'member']);
    }

    await TimeEntryModel.deleteMany({ cardId: card._id });
    await CommentModel.deleteMany({ cardId: card._id });
    await CardModel.deleteOne({ _id: card._id });
    res.json({ ok: true });
  }),
);

cardsRouter.post(
  '/:cardId/time-entries',
  asyncHandler(async (req: Request, res: Response) => {
    const cardId = req.params.cardId as string;
    const teamId = await teamIdFromCard(cardId);
    const membership = await requireMembership(teamId, req.userId);
    const card = await CardModel.findById(asObjectId(cardId)).lean();

    if (!card) {
      throw new AppError(404, 'Карточка не найдена');
    }

    if (
      !canLogOnCard(
        membership.role,
        card.assigneeId?.toString() ?? null,
        req.userId,
      )
    ) {
      throw new AppError(403, 'Можно списывать только на своих карточках');
    }

    const board = await BoardModel.findById(card.boardId).lean();

    if (!board) {
      throw new AppError(404, 'Доска не найдена');
    }

    const hours = readHours(req.body, 'hours');
    const rate = await rateForUser(board.projectId, asObjectId(req.userId));
    const workedAt = readOptionalDate(req.body, 'workedAt') ?? new Date();

    const entry = await TimeEntryModel.create({
      cardId: card._id,
      userId: asObjectId(req.userId),
      hours,
      rateSnapshot: rate,
      amount: calcAmount(hours, rate),
      workedAt,
    });

    res.status(201).json({
      id: entry._id.toString(),
      hours: entry.hours,
      amount: entry.amount,
      rateSnapshot: entry.rateSnapshot,
    });
  }),
);

cardsRouter.patch(
  '/time-entries/:entryId',
  asyncHandler(async (req: Request, res: Response) => {
    const entryId = req.params.entryId as string;
    const entry = await TimeEntryModel.findById(asObjectId(entryId, 'entryId'));

    if (!entry) {
      throw new AppError(404, 'Списание не найдено');
    }

    const teamId = await teamIdFromCard(entry.cardId.toString());
    const membership = await requireMembership(teamId, req.userId);
    const card = await CardModel.findById(entry.cardId).lean();

    if (!card) {
      throw new AppError(404, 'Карточка не найдена');
    }

    const isOwn = entry.userId.toString() === req.userId;

    if (membership.role === 'member') {
      if (!isOwn || card.assigneeId?.toString() !== req.userId) {
        throw new AppError(403, 'Недостаточно прав');
      }
    } else {
      assertRole(membership.role, ['owner', 'admin']);
    }

    entry.hours = readHours(req.body, 'hours');
    entry.amount = calcAmount(entry.hours, entry.rateSnapshot);
    await entry.save();
    res.json({ ok: true, amount: entry.amount });
  }),
);

cardsRouter.delete(
  '/time-entries/:entryId',
  asyncHandler(async (req: Request, res: Response) => {
    const entryId = req.params.entryId as string;
    const entry = await TimeEntryModel.findById(asObjectId(entryId, 'entryId'));

    if (!entry) {
      throw new AppError(404, 'Списание не найдено');
    }

    const teamId = await teamIdFromCard(entry.cardId.toString());
    const membership = await requireMembership(teamId, req.userId);
    const card = await CardModel.findById(entry.cardId).lean();

    if (!card) {
      throw new AppError(404, 'Карточка не найдена');
    }

    const isOwn = entry.userId.toString() === req.userId;

    if (membership.role === 'member') {
      if (!isOwn || card.assigneeId?.toString() !== req.userId) {
        throw new AppError(403, 'Недостаточно прав');
      }
    } else {
      assertRole(membership.role, ['owner', 'admin']);
    }

    await entry.deleteOne();
    res.json({ ok: true });
  }),
);

cardsRouter.post(
  '/:cardId/comments',
  asyncHandler(async (req: Request, res: Response) => {
    const cardId = req.params.cardId as string;
    const teamId = await teamIdFromCard(cardId);
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin', 'member']);

    const body = readString(req.body, 'body');
    const comment = await CommentModel.create({
      cardId: asObjectId(cardId),
      userId: asObjectId(req.userId),
      body,
    });

    const card = await CardModel.findById(asObjectId(cardId)).lean();
    const board = card
      ? await BoardModel.findById(card.boardId).lean()
      : null;

    if (card && board) {
      recordActivity({
        teamId,
        projectId: board.projectId,
        boardId: card.boardId,
        cardId: card._id,
        actorId: req.userId,
        kind: 'comment_added',
        cardTitle: card.title,
        detail: truncateDetail(body),
      });
    }

    res.status(201).json({ id: comment._id.toString(), body: comment.body });
  }),
);

cardsRouter.delete(
  '/comments/:commentId',
  asyncHandler(async (req: Request, res: Response) => {
    const commentId = req.params.commentId as string;
    const comment = await CommentModel.findById(
      asObjectId(commentId, 'commentId'),
    );

    if (!comment) {
      throw new AppError(404, 'Комментарий не найден');
    }

    const teamId = await teamIdFromCard(comment.cardId.toString());
    const membership = await requireMembership(teamId, req.userId);
    const isAuthor = comment.userId.toString() === req.userId;

    if (!isAuthor) {
      assertRole(membership.role, ['owner', 'admin']);
    }

    await comment.deleteOne();
    res.json({ ok: true });
  }),
);

cardsRouter.post(
  '/:cardId/checklists',
  asyncHandler(async (req: Request, res: Response) => {
    const cardId = req.params.cardId as string;
    const card = await requireEditableCard(req, cardId);
    const rawTitle = readOptionalString(req.body, 'title') ?? 'Чеклист';
    const title = assertMaxLength(rawTitle, 'title', CHECKLIST_TITLE_MAX);
    if (!Array.isArray(card.checklists)) {
      card.checklists = [];
    }

    const last = card.checklists.reduce(
      (max, list) => Math.max(max, list.position),
      -1,
    );

    card.checklists.push({
      title,
      position: last + 1,
      items: [],
    });
    card.markModified('checklists');
    await card.save();

    const created = card.checklists[card.checklists.length - 1];

    res.status(201).json({
      id: created?._id ? String(created._id) : undefined,
      title,
      position: last + 1,
    });
  }),
);

cardsRouter.patch(
  '/checklists/:checklistId',
  asyncHandler(async (req: Request, res: Response) => {
    const checklistId = req.params.checklistId as string;
    const { card, checklist } = await findCardByChecklist(checklistId);
    await requireEditableCard(req, card._id.toString());

    const title = assertMaxLength(
      readString(req.body, 'title'),
      'title',
      CHECKLIST_TITLE_MAX,
    );
    checklist.title = title;
    card.markModified('checklists');
    await card.save();
    res.json({ ok: true });
  }),
);

cardsRouter.delete(
  '/checklists/:checklistId',
  asyncHandler(async (req: Request, res: Response) => {
    const checklistId = req.params.checklistId as string;
    const { card } = await findCardByChecklist(checklistId);
    await requireEditableCard(req, card._id.toString());

    const id = asObjectId(checklistId, 'checklistId');
    const index = card.checklists.findIndex((list) => list._id?.equals(id));

    if (index === -1) {
      throw new AppError(404, 'Чеклист не найден');
    }

    card.checklists.splice(index, 1);
    card.markModified('checklists');
    await card.save();
    res.json({ ok: true });
  }),
);

cardsRouter.post(
  '/checklists/:checklistId/items',
  asyncHandler(async (req: Request, res: Response) => {
    const checklistId = req.params.checklistId as string;
    const { card, checklist } = await findCardByChecklist(checklistId);
    await requireEditableCard(req, card._id.toString());

    const text = assertMaxLength(
      readString(req.body, 'text'),
      'text',
      CHECKLIST_ITEM_MAX,
    );
    const last = checklist.items.reduce(
      (max, item) => Math.max(max, item.position),
      -1,
    );

    checklist.items.push({
      text,
      done: false,
      position: last + 1,
    });
    card.markModified('checklists');
    await card.save();

    const created = checklist.items[checklist.items.length - 1];

    res.status(201).json({
      id: created?._id ? String(created._id) : undefined,
      text,
      done: false,
      position: last + 1,
    });
  }),
);

cardsRouter.patch(
  '/checklist-items/:itemId',
  asyncHandler(async (req: Request, res: Response) => {
    const itemId = req.params.itemId as string;
    const { card, item } = await findCardByItem(itemId);
    await requireEditableCard(req, card._id.toString());

    if ('text' in (req.body as object)) {
      item.text = assertMaxLength(
        readString(req.body, 'text'),
        'text',
        CHECKLIST_ITEM_MAX,
      );
    }

    if ('done' in (req.body as object)) {
      item.done = readBoolean(req.body, 'done');
    }

    card.markModified('checklists');
    await card.save();
    res.json({ ok: true });
  }),
);

cardsRouter.delete(
  '/checklist-items/:itemId',
  asyncHandler(async (req: Request, res: Response) => {
    const itemId = req.params.itemId as string;
    const { card, checklist, item } = await findCardByItem(itemId);
    await requireEditableCard(req, card._id.toString());

    const index = checklist.items.findIndex((row) => row._id?.equals(item._id));

    if (index === -1) {
      throw new AppError(404, 'Пункт не найден');
    }

    checklist.items.splice(index, 1);
    card.markModified('checklists');
    await card.save();
    res.json({ ok: true });
  }),
);
