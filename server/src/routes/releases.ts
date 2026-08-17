import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import { AppError } from '../errors/app-error.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import {
  requireMembership,
  teamIdFromRelease,
} from '../middleware/access.js';
import { BoardModel } from '../models/board.js';
import { CardModel } from '../models/card.js';
import { ColumnModel } from '../models/column.js';
import { ProjectModel } from '../models/project.js';
import { ReleaseModel } from '../models/release.js';
import { UserModel } from '../models/user.js';
import { normalizeName } from '../utils/crypto.js';
import {
  asObjectId,
  assertFeatureOn,
  assertRole,
  readOptionalDate,
  readOptionalString,
  readString,
} from '../utils/validate.js';

async function assertProjectReleasesOn(
  projectId: Types.ObjectId,
): Promise<void> {
  const project = await ProjectModel.findById(projectId).lean();

  if (!project) {
    throw new AppError(404, 'Проект не найден');
  }

  assertFeatureOn(project.releasesEnabled, 'Релизы выключены в проекте');
}

export const releasesRouter = Router();
releasesRouter.use(requireAuth);

releasesRouter.get(
  '/:releaseId',
  asyncHandler(async (req: Request, res: Response) => {
    const releaseId = req.params.releaseId as string;
    const teamId = await teamIdFromRelease(releaseId);
    const membership = await requireMembership(teamId, req.userId);
    const release = await ReleaseModel.findById(asObjectId(releaseId)).lean();

    if (!release) {
      throw new AppError(404, 'Релиз не найден');
    }

    await assertProjectReleasesOn(release.projectId);

    const cards = await CardModel.find({ releaseId: release._id }).lean();
    const boards = await BoardModel.find({
      _id: { $in: cards.map((card) => card.boardId) },
    }).lean();
    const columns = await ColumnModel.find({
      _id: { $in: cards.map((card) => card.columnId) },
    }).lean();
    const users = await UserModel.find({
      _id: { $in: cards.map((card) => card.assigneeId).filter(Boolean) },
    }).lean();

    res.json({
      id: release._id.toString(),
      projectId: release.projectId.toString(),
      name: release.name,
      date: release.date,
      status: release.status,
      role: membership.role,
      cards: cards.map((card) => {
        const board = boards.find(
          (item) => item._id.toString() === card.boardId.toString(),
        );
        const column = columns.find(
          (item) => item._id.toString() === card.columnId.toString(),
        );
        const assignee = users.find(
          (item) => item._id.toString() === card.assigneeId?.toString(),
        );

        return {
          id: card._id.toString(),
          title: card.title,
          boardName: board?.name ?? '',
          columnName: column?.name ?? '',
          assigneeName: assignee?.displayName ?? null,
        };
      }),
    });
  }),
);

releasesRouter.patch(
  '/:releaseId',
  asyncHandler(async (req: Request, res: Response) => {
    const releaseId = req.params.releaseId as string;
    const teamId = await teamIdFromRelease(releaseId);
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin']);

    const release = await ReleaseModel.findById(asObjectId(releaseId));

    if (!release) {
      throw new AppError(404, 'Релиз не найден');
    }

    await assertProjectReleasesOn(release.projectId);

    const name = readOptionalString(req.body, 'name');

    if (name) {
      const nameNormalized = normalizeName(name);
      const exists = await ReleaseModel.findOne({
        projectId: release.projectId,
        nameNormalized,
        _id: { $ne: release._id },
      }).lean();

      if (exists) {
        throw new AppError(409, 'Название релиза уже занято');
      }

      release.name = name;
      release.nameNormalized = nameNormalized;
    }

    if ('date' in (req.body as object)) {
      release.date = readOptionalDate(req.body, 'date') ?? null;
    }

    if (req.body?.status === 'planned' || req.body?.status === 'released') {
      release.status = req.body.status;
    }

    await release.save();
    res.json({
      id: release._id.toString(),
      name: release.name,
      date: release.date,
      status: release.status,
    });
  }),
);

releasesRouter.delete(
  '/:releaseId',
  asyncHandler(async (req: Request, res: Response) => {
    const releaseId = req.params.releaseId as string;
    const teamId = await teamIdFromRelease(releaseId);
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin']);

    const release = await ReleaseModel.findById(asObjectId(releaseId)).lean();

    if (!release) {
      throw new AppError(404, 'Релиз не найден');
    }

    await assertProjectReleasesOn(release.projectId);

    await CardModel.updateMany(
      { releaseId: asObjectId(releaseId) },
      { $set: { releaseId: null } },
    );
    await ReleaseModel.deleteOne({ _id: asObjectId(releaseId) });
    res.json({ ok: true });
  }),
);

releasesRouter.post(
  '/:releaseId/cards',
  asyncHandler(async (req: Request, res: Response) => {
    const releaseId = req.params.releaseId as string;
    const teamId = await teamIdFromRelease(releaseId);
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin', 'member']);

    const release = await ReleaseModel.findById(asObjectId(releaseId)).lean();

    if (!release) {
      throw new AppError(404, 'Релиз не найден');
    }

    await assertProjectReleasesOn(release.projectId);

    const cardId = readString(req.body, 'cardId');
    const card = await CardModel.findById(asObjectId(cardId, 'cardId'));

    if (!card) {
      throw new AppError(404, 'Карточка не найдена');
    }

    const board = await BoardModel.findById(card.boardId).lean();

    if (!board || board.projectId.toString() !== release.projectId.toString()) {
      throw new AppError(400, 'Карточка из другого проекта');
    }

    card.releaseId = release._id;
    await card.save();
    res.json({ ok: true });
  }),
);

releasesRouter.delete(
  '/:releaseId/cards/:cardId',
  asyncHandler(async (req: Request, res: Response) => {
    const releaseId = req.params.releaseId as string;
    const cardId = req.params.cardId as string;
    const teamId = await teamIdFromRelease(releaseId);
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin', 'member']);

    const release = await ReleaseModel.findById(asObjectId(releaseId)).lean();

    if (!release) {
      throw new AppError(404, 'Релиз не найден');
    }

    await assertProjectReleasesOn(release.projectId);

    await CardModel.updateOne(
      {
        _id: asObjectId(cardId, 'cardId'),
        releaseId: asObjectId(releaseId),
      },
      { $set: { releaseId: null } },
    );

    res.json({ ok: true });
  }),
);
