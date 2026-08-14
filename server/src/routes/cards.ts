import { Router } from 'express';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../errors/app-error.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import {
  requireMembership,
  teamIdFromBoard,
  teamIdFromCard
} from '../middleware/access.js';
import { BoardModel } from '../models/board.js';
import { CardModel } from '../models/card.js';
import { ColumnModel } from '../models/column.js';
import { CommentModel } from '../models/comment.js';
import { LabelModel } from '../models/label.js';
import { ReleaseModel } from '../models/release.js';
import { TimeEntryModel } from '../models/time-entry.js';
import { UserModel } from '../models/user.js';
import { rateForUser, recalcCardPlan } from '../services/plan.js';
import { calcAmount } from '../utils/rates.js';
import {
  asObjectId,
  assertRole,
  readEstimate,
  readHours,
  readOptionalDate,
  readOptionalString,
  readString
} from '../utils/validate.js';
import type { TeamRole } from '../constants.js';

export const cardsRouter = Router();
cardsRouter.use(requireAuth);

function canEditCards(role: TeamRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'member';
}

function canLogOnCard(
  role: TeamRole,
  assigneeId: string | null,
  userId: string
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
      boardId: board._id
    }).lean();

    if (!column) {
      throw new AppError(400, 'Колонка не принадлежит доске');
    }

    const last = await CardModel.findOne({ columnId: column._id })
      .sort({ position: -1 })
      .lean();

    const assigneeRaw = readOptionalString(req.body, 'assigneeId');
    const releaseRaw = readOptionalString(req.body, 'releaseId');
    const estimateHours =
      req.body?.estimateHours === undefined || req.body?.estimateHours === ''
        ? 0
        : readEstimate(req.body, 'estimateHours');

    const card = await CardModel.create({
      boardId: board._id,
      columnId: column._id,
      title: readString(req.body, 'title'),
      assigneeId: assigneeRaw ? asObjectId(assigneeRaw, 'assigneeId') : null,
      dueDate: readOptionalDate(req.body, 'dueDate') ?? null,
      estimateHours,
      releaseId: releaseRaw ? asObjectId(releaseRaw, 'releaseId') : null,
      labelIds: [],
      position: (last?.position ?? -1) + 1,
      planAmount: 0
    });

    if (Array.isArray(req.body?.labelIds)) {
      const ids = (req.body.labelIds as unknown[])
        .filter((id): id is string => typeof id === 'string')
        .map((id) => asObjectId(id, 'labelId'));
      const labels = await LabelModel.find({
        _id: { $in: ids },
        boardId: board._id
      }).lean();
      card.labelIds = labels.map((label) => label._id);
      await card.save();
    }

    if (card.releaseId) {
      const release = await ReleaseModel.findOne({
        _id: card.releaseId,
        projectId: board.projectId
      }).lean();

      if (!release) {
        throw new AppError(400, 'Релиз не принадлежит проекту');
      }
    }

    await recalcCardPlan(card._id);
    const fresh = await CardModel.findById(card._id).lean();

    res.status(201).json({
      id: card._id.toString(),
      title: card.title,
      planAmount: fresh?.planAmount ?? 0
    });
  })
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
      ...(card.assigneeId ? [card.assigneeId] : [])
    ];
    const users = await UserModel.find({ _id: { $in: userIds } }).lean();
    const userName = (id: mongoose.Types.ObjectId): string =>
      users.find((user) => user._id.toString() === id.toString())
        ?.displayName ?? '';

    const isOwn = card.assigneeId?.toString() === req.userId;
    const showAllMoney =
      membership.role === 'owner' || membership.role === 'admin';
    const showOwnMoney = membership.role === 'member' && isOwn;

    res.json({
      id: card._id.toString(),
      boardId: card.boardId.toString(),
      columnId: card.columnId.toString(),
      title: card.title,
      assigneeId: card.assigneeId?.toString() ?? null,
      dueDate: card.dueDate,
      estimateHours: card.estimateHours,
      releaseId: card.releaseId?.toString() ?? null,
      labelIds: card.labelIds.map((id) => id.toString()),
      planAmount: showAllMoney || showOwnMoney ? card.planAmount : undefined,
      timeEntries: entries.map((entry) => {
        const own = entry.userId.toString() === req.userId;
        const showMoney = showAllMoney || (membership.role === 'member' && own);

        return {
          id: entry._id.toString(),
          userId: entry.userId.toString(),
          displayName: userName(entry.userId),
          hours: entry.hours,
          rateSnapshot: showMoney ? entry.rateSnapshot : undefined,
          amount: showMoney ? entry.amount : undefined,
          workedAt: entry.workedAt
        };
      }),
      comments: comments.map((comment) => ({
        id: comment._id.toString(),
        userId: comment.userId.toString(),
        displayName: userName(comment.userId),
        body: comment.body,
        createdAt: comment.createdAt
      }))
    });
  })
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

    if (req.body?.columnId) {
      const column = await ColumnModel.findOne({
        _id: asObjectId(String(req.body.columnId), 'columnId'),
        boardId: card.boardId
      }).lean();

      if (!column) {
        throw new AppError(400, 'Колонка не принадлежит доске');
      }

      card.columnId = column._id;
    }

    if (typeof req.body?.position === 'number') {
      card.position = req.body.position;
    }

    if ('assigneeId' in (req.body as object)) {
      const raw = req.body.assigneeId;
      card.assigneeId =
        typeof raw === 'string' && raw ? asObjectId(raw, 'assigneeId') : null;
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
        const release = await ReleaseModel.findOne({
          _id: asObjectId(raw, 'releaseId'),
          projectId: board.projectId
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
        boardId: card.boardId
      }).lean();
      card.labelIds = labels.map((label) => label._id);
    }

    await card.save();
    await recalcCardPlan(card._id);
    res.json({ ok: true });
  })
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
      cardId: card._id
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
  })
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
        req.userId
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
      workedAt
    });

    res.status(201).json({
      id: entry._id.toString(),
      hours: entry.hours,
      amount: entry.amount,
      rateSnapshot: entry.rateSnapshot
    });
  })
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
  })
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
  })
);

cardsRouter.post(
  '/:cardId/comments',
  asyncHandler(async (req: Request, res: Response) => {
    const cardId = req.params.cardId as string;
    const teamId = await teamIdFromCard(cardId);
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin', 'member']);

    const comment = await CommentModel.create({
      cardId: asObjectId(cardId),
      userId: asObjectId(req.userId),
      body: readString(req.body, 'body')
    });

    res.status(201).json({ id: comment._id.toString(), body: comment.body });
  })
);

cardsRouter.delete(
  '/comments/:commentId',
  asyncHandler(async (req: Request, res: Response) => {
    const commentId = req.params.commentId as string;
    const comment = await CommentModel.findById(
      asObjectId(commentId, 'commentId')
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
  })
);
