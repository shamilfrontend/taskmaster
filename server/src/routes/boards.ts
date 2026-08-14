import { Router } from 'express';
import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import {
  requireMembership,
  teamIdFromBoard,
  teamIdFromColumn
} from '../middleware/access.js';
import { BoardModel } from '../models/board.js';
import { CardModel } from '../models/card.js';
import { ColumnModel } from '../models/column.js';
import { LabelModel } from '../models/label.js';
import { ReleaseModel } from '../models/release.js';
import { TimeEntryModel } from '../models/time-entry.js';
import { UserModel } from '../models/user.js';
import { deleteBoardCascade } from '../services/cascade.js';
import {
  asObjectId,
  assertRole,
  readLabelColor,
  readOptionalString,
  readString
} from '../utils/validate.js';

export const boardsRouter = Router();
boardsRouter.use(requireAuth);

boardsRouter.get(
  '/:boardId',
  asyncHandler(async (req: Request, res: Response) => {
    const boardId = req.params.boardId as string;
    const teamId = await teamIdFromBoard(boardId);
    const membership = await requireMembership(teamId, req.userId);
    const board = await BoardModel.findById(asObjectId(boardId)).lean();

    if (!board) {
      throw new AppError(404, 'Доска не найдена');
    }

    const columns = await ColumnModel.find({ boardId: board._id })
      .sort({ position: 1 })
      .lean();
    const labels = await LabelModel.find({ boardId: board._id }).lean();
    const cards = await CardModel.find({ boardId: board._id })
      .sort({ position: 1 })
      .lean();
    const releases = await ReleaseModel.find({
      projectId: board.projectId
    }).lean();
    const users = await UserModel.find({
      _id: { $in: cards.map((card) => card.assigneeId).filter(Boolean) }
    }).lean();
    const entries = await TimeEntryModel.find({
      cardId: { $in: cards.map((card) => card._id) }
    }).lean();

    const hideMoney = membership.role === 'viewer';

    res.json({
      id: board._id.toString(),
      projectId: board.projectId.toString(),
      name: board.name,
      role: membership.role,
      columns: columns.map((column) => ({
        id: column._id.toString(),
        name: column.name,
        position: column.position,
        isDone: column.isDone
      })),
      labels: labels.map((label) => ({
        id: label._id.toString(),
        name: label.name,
        color: label.color
      })),
      releases: releases.map((release) => ({
        id: release._id.toString(),
        name: release.name,
        status: release.status
      })),
      cards: cards.map((card) => {
        const factHours = entries
          .filter((entry) => entry.cardId.toString() === card._id.toString())
          .reduce((sum, entry) => sum + entry.hours, 0);
        const factAmount = entries
          .filter((entry) => entry.cardId.toString() === card._id.toString())
          .reduce((sum, entry) => sum + entry.amount, 0);
        const isOwn =
          card.assigneeId?.toString() === req.userId;
        const showMoney =
          !hideMoney &&
          (membership.role === 'owner' ||
            membership.role === 'admin' ||
            isOwn);
        const assignee = users.find(
          (user) => user._id.toString() === card.assigneeId?.toString()
        );
        const release = releases.find(
          (item) => item._id.toString() === card.releaseId?.toString()
        );

        return {
          id: card._id.toString(),
          columnId: card.columnId.toString(),
          title: card.title,
          assigneeId: card.assigneeId?.toString() ?? null,
          assigneeName: assignee?.displayName ?? null,
          dueDate: card.dueDate,
          estimateHours: card.estimateHours,
          factHours,
          planAmount: showMoney ? card.planAmount : undefined,
          factAmount: showMoney ? factAmount : undefined,
          releaseId: card.releaseId?.toString() ?? null,
          releaseName: release?.name ?? null,
          labelIds: card.labelIds.map((id) => id.toString()),
          position: card.position
        };
      })
    });
  })
);

boardsRouter.patch(
  '/:boardId',
  asyncHandler(async (req: Request, res: Response) => {
    const boardId = req.params.boardId as string;
    const teamId = await teamIdFromBoard(boardId);
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin']);

    const board = await BoardModel.findById(asObjectId(boardId));

    if (!board) {
      throw new AppError(404, 'Доска не найдена');
    }

    board.name = readString(req.body, 'name');
    await board.save();
    res.json({ id: board._id.toString(), name: board.name });
  })
);

boardsRouter.delete(
  '/:boardId',
  asyncHandler(async (req: Request, res: Response) => {
    const boardId = req.params.boardId as string;
    const teamId = await teamIdFromBoard(boardId);
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin']);
    await deleteBoardCascade(asObjectId(boardId));
    res.json({ ok: true });
  })
);

boardsRouter.post(
  '/:boardId/columns',
  asyncHandler(async (req: Request, res: Response) => {
    const boardId = req.params.boardId as string;
    const teamId = await teamIdFromBoard(boardId);
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin']);

    const last = await ColumnModel.findOne({ boardId: asObjectId(boardId) })
      .sort({ position: -1 })
      .lean();

    const column = await ColumnModel.create({
      boardId: asObjectId(boardId),
      name: readString(req.body, 'name'),
      position: (last?.position ?? -1) + 1,
      isDone: false
    });

    res.status(201).json({
      id: column._id.toString(),
      name: column.name,
      position: column.position,
      isDone: column.isDone
    });
  })
);

boardsRouter.patch(
  '/columns/:columnId',
  asyncHandler(async (req: Request, res: Response) => {
    const columnId = req.params.columnId as string;
    const teamId = await teamIdFromColumn(columnId);
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin']);

    const column = await ColumnModel.findById(asObjectId(columnId, 'columnId'));

    if (!column) {
      throw new AppError(404, 'Колонка не найдена');
    }

    const name = readOptionalString(req.body, 'name');

    if (name) {
      column.name = name;
    }

    if (typeof req.body?.position === 'number') {
      column.position = req.body.position;
    }

    if (req.body?.isDone === true) {
      await ColumnModel.updateMany(
        { boardId: column.boardId },
        { $set: { isDone: false } }
      );
      column.isDone = true;
    } else if (req.body?.isDone === false) {
      column.isDone = false;
    }

    await column.save();
    res.json({
      id: column._id.toString(),
      name: column.name,
      position: column.position,
      isDone: column.isDone
    });
  })
);

boardsRouter.delete(
  '/columns/:columnId',
  asyncHandler(async (req: Request, res: Response) => {
    const columnId = req.params.columnId as string;
    const teamId = await teamIdFromColumn(columnId);
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin']);

    const count = await CardModel.countDocuments({
      columnId: asObjectId(columnId, 'columnId')
    });

    if (count > 0) {
      throw new AppError(409, 'Сначала переместите карточки');
    }

    await ColumnModel.deleteOne({ _id: asObjectId(columnId, 'columnId') });
    res.json({ ok: true });
  })
);

boardsRouter.post(
  '/:boardId/labels',
  asyncHandler(async (req: Request, res: Response) => {
    const boardId = req.params.boardId as string;
    const teamId = await teamIdFromBoard(boardId);
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin']);

    const label = await LabelModel.create({
      boardId: asObjectId(boardId),
      name: readString(req.body, 'name'),
      color: readLabelColor(req.body, 'color')
    });

    res.status(201).json({
      id: label._id.toString(),
      name: label.name,
      color: label.color
    });
  })
);

boardsRouter.delete(
  '/labels/:labelId',
  asyncHandler(async (req: Request, res: Response) => {
    const labelId = req.params.labelId as string;
    const label = await LabelModel.findById(asObjectId(labelId, 'labelId')).lean();

    if (!label) {
      throw new AppError(404, 'Метка не найдена');
    }

    const teamId = await teamIdFromBoard(label.boardId.toString());
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin']);

    await CardModel.updateMany(
      { labelIds: label._id },
      { $pull: { labelIds: label._id } }
    );
    await LabelModel.deleteOne({ _id: label._id });
    res.json({ ok: true });
  })
);
