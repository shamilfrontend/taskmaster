import { Router } from 'express';
import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import {
  requireProjectAccessFromBoard,
  requireProjectAccessFromColumn,
} from '../middleware/access.js';
import { BoardModel } from '../models/board.js';
import { CardModel } from '../models/card.js';
import { ColumnModel } from '../models/column.js';
import { CommentModel } from '../models/comment.js';
import { LabelModel } from '../models/label.js';
import { ProjectModel } from '../models/project.js';
import { ReleaseModel } from '../models/release.js';
import { TimeEntryModel } from '../models/time-entry.js';
import { UserModel } from '../models/user.js';
import { deleteBoardCascade } from '../services/cascade.js';
import {
  asObjectId,
  assertRole,
  isFeatureOn,
  readLabelColor,
  readOptionalString,
  readString,
} from '../utils/validate.js';

export const boardsRouter = Router();
boardsRouter.use(requireAuth);

boardsRouter.get(
  '/:boardId',
  asyncHandler(async (req: Request, res: Response) => {
    const boardId = req.params.boardId as string;
    const access = await requireProjectAccessFromBoard(boardId, req.userId);
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
      projectId: board.projectId,
    }).lean();
    const users = await UserModel.find({
      _id: { $in: cards.map((card) => card.assigneeId).filter(Boolean) },
    }).lean();
    const entries = await TimeEntryModel.find({
      cardId: { $in: cards.map((card) => card._id) },
    }).lean();
    const commentRows = await CommentModel.find({
      cardId: { $in: cards.map((card) => card._id) },
    })
      .select('cardId')
      .lean();
    const commentCountByCard = new Map<string, number>();

    for (const row of commentRows) {
      const id = row.cardId.toString();
      commentCountByCard.set(id, (commentCountByCard.get(id) ?? 0) + 1);
    }
    const project = await ProjectModel.findById(board.projectId).lean();
    const releasesEnabled = isFeatureOn(project?.releasesEnabled);

    res.json({
      id: board._id.toString(),
      projectId: board.projectId.toString(),
      name: board.name,
      role: access.role,
      columns: columns.map((column) => ({
        id: column._id.toString(),
        name: column.name,
        position: column.position,
        isDone: column.isDone,
      })),
      labels: labels.map((label) => ({
        id: label._id.toString(),
        name: label.name,
        color: label.color,
      })),
      releases: releasesEnabled
        ? releases.map((release) => ({
          id: release._id.toString(),
          name: release.name,
          status: release.status,
        }))
        : [],
      cards: cards.map((card) => {
        const factHours = entries
          .filter((entry) => entry.cardId.toString() === card._id.toString())
          .reduce((sum, entry) => sum + entry.hours, 0);
        const assignee = users.find(
          (user) => user._id.toString() === card.assigneeId?.toString(),
        );
        const release = releasesEnabled
          ? releases.find(
            (item) => item._id.toString() === card.releaseId?.toString(),
          )
          : undefined;
        const checklistItems = (card.checklists ?? []).flatMap(
          (list) => list.items,
        );

        return {
          id: card._id.toString(),
          columnId: card.columnId.toString(),
          title: card.title,
          assigneeId: card.assigneeId?.toString() ?? null,
          assigneeName: assignee?.displayName ?? null,
          assigneeAvatarUrl: assignee?.avatarUrl ?? null,
          dueDate: card.dueDate,
          estimateHours: card.estimateHours,
          factHours,
          releaseId: releasesEnabled
            ? card.releaseId?.toString() ?? null
            : null,
          releaseName: release?.name ?? null,
          labelIds: card.labelIds.map((id) => id.toString()),
          commentCount: commentCountByCard.get(card._id.toString()) ?? 0,
          checklistDone: checklistItems.filter((item) => item.done).length,
          checklistTotal: checklistItems.length,
          position: card.position,
        };
      }),
    });
  }),
);

boardsRouter.patch(
  '/:boardId',
  asyncHandler(async (req: Request, res: Response) => {
    const boardId = req.params.boardId as string;
    const access = await requireProjectAccessFromBoard(boardId, req.userId);
    assertRole(access.role, ['owner', 'admin']);

    const board = await BoardModel.findById(asObjectId(boardId));

    if (!board) {
      throw new AppError(404, 'Доска не найдена');
    }

    board.name = readString(req.body, 'name');
    await board.save();
    res.json({ id: board._id.toString(), name: board.name });
  }),
);

boardsRouter.delete(
  '/:boardId',
  asyncHandler(async (req: Request, res: Response) => {
    const boardId = req.params.boardId as string;
    const access = await requireProjectAccessFromBoard(boardId, req.userId);
    assertRole(access.role, ['owner', 'admin']);
    await deleteBoardCascade(asObjectId(boardId));
    res.json({ ok: true });
  }),
);

boardsRouter.post(
  '/:boardId/columns',
  asyncHandler(async (req: Request, res: Response) => {
    const boardId = req.params.boardId as string;
    const access = await requireProjectAccessFromBoard(boardId, req.userId);
    assertRole(access.role, ['owner', 'admin']);

    const last = await ColumnModel.findOne({ boardId: asObjectId(boardId) })
      .sort({ position: -1 })
      .lean();

    const column = await ColumnModel.create({
      boardId: asObjectId(boardId),
      name: readString(req.body, 'name'),
      position: (last?.position ?? -1) + 1,
      isDone: false,
    });

    res.status(201).json({
      id: column._id.toString(),
      name: column.name,
      position: column.position,
      isDone: column.isDone,
    });
  }),
);

boardsRouter.patch(
  '/columns/:columnId',
  asyncHandler(async (req: Request, res: Response) => {
    const columnId = req.params.columnId as string;
    const access = await requireProjectAccessFromColumn(columnId, req.userId);
    assertRole(access.role, ['owner', 'admin']);

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

    await column.save();
    res.json({
      id: column._id.toString(),
      name: column.name,
      position: column.position,
      isDone: column.isDone,
    });
  }),
);

boardsRouter.delete(
  '/columns/:columnId',
  asyncHandler(async (req: Request, res: Response) => {
    const columnId = req.params.columnId as string;
    const access = await requireProjectAccessFromColumn(columnId, req.userId);
    assertRole(access.role, ['owner', 'admin']);

    const column = await ColumnModel.findById(asObjectId(columnId, 'columnId'));

    if (!column) {
      throw new AppError(404, 'Колонка не найдена');
    }

    const count = await CardModel.countDocuments({
      columnId: column._id,
    });

    if (count > 0) {
      throw new AppError(409, 'Сначала переместите карточки');
    }

    await ColumnModel.deleteOne({ _id: column._id });
    res.json({ ok: true });
  }),
);

boardsRouter.post(
  '/:boardId/labels',
  asyncHandler(async (req: Request, res: Response) => {
    const boardId = req.params.boardId as string;
    const access = await requireProjectAccessFromBoard(boardId, req.userId);
    assertRole(access.role, ['owner', 'admin']);

    const label = await LabelModel.create({
      boardId: asObjectId(boardId),
      name: readString(req.body, 'name'),
      color: readLabelColor(req.body, 'color'),
    });

    res.status(201).json({
      id: label._id.toString(),
      name: label.name,
      color: label.color,
    });
  }),
);

boardsRouter.patch(
  '/labels/:labelId',
  asyncHandler(async (req: Request, res: Response) => {
    const labelId = req.params.labelId as string;
    const label = await LabelModel.findById(asObjectId(labelId, 'labelId'));

    if (!label) {
      throw new AppError(404, 'Метка не найдена');
    }

    const access = await requireProjectAccessFromBoard(
      label.boardId.toString(),
      req.userId,
    );
    assertRole(access.role, ['owner', 'admin']);

    label.name = readString(req.body, 'name');
    await label.save();

    res.json({
      id: label._id.toString(),
      name: label.name,
      color: label.color,
    });
  }),
);

boardsRouter.delete(
  '/labels/:labelId',
  asyncHandler(async (req: Request, res: Response) => {
    const labelId = req.params.labelId as string;
    const label = await LabelModel.findById(asObjectId(labelId, 'labelId')).lean();

    if (!label) {
      throw new AppError(404, 'Метка не найдена');
    }

    const access = await requireProjectAccessFromBoard(
      label.boardId.toString(),
      req.userId,
    );
    assertRole(access.role, ['owner', 'admin']);

    await CardModel.updateMany(
      { labelIds: label._id },
      { $pull: { labelIds: label._id } },
    );
    await LabelModel.deleteOne({ _id: label._id });
    res.json({ ok: true });
  }),
);
