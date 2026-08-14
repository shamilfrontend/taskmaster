import { Router } from 'express';
import type { Request, Response } from 'express';
import { DEFAULT_COLUMNS, type TeamRole } from '../constants.js';
import { AppError } from '../errors/app-error.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import {
  requireMembership,
  teamIdFromProject
} from '../middleware/access.js';
import { BoardModel } from '../models/board.js';
import { CardModel } from '../models/card.js';
import { ColumnModel } from '../models/column.js';
import { ProjectModel } from '../models/project.js';
import { ProjectMemberRateModel } from '../models/project-member-rate.js';
import { ReleaseModel } from '../models/release.js';
import { TeamMemberModel } from '../models/team-member.js';
import { TimeEntryModel } from '../models/time-entry.js';
import { UserModel } from '../models/user.js';
import { deleteProjectCascade } from '../services/cascade.js';
import { recalcAssigneePlans, recalcRolePlans } from '../services/plan.js';
import { normalizeName } from '../utils/crypto.js';
import { resolveRate } from '../utils/rates.js';
import {
  asObjectId,
  assertRole,
  readBudget,
  readNumber,
  readOptionalDate,
  readOptionalNumber,
  readString
} from '../utils/validate.js';

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

async function projectFact(projectId: string): Promise<number> {
  const boards = await BoardModel.find({
    projectId: asObjectId(projectId)
  }).lean();
  const cards = await CardModel.find({
    boardId: { $in: boards.map((board) => board._id) }
  }).lean();
  const entries = await TimeEntryModel.find({
    cardId: { $in: cards.map((card) => card._id) }
  }).lean();

  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}

projectsRouter.post(
  '/:projectId/boards',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const teamId = await teamIdFromProject(projectId);
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin']);

    const board = await BoardModel.create({
      projectId: asObjectId(projectId),
      name: readString(req.body, 'name')
    });

    await ColumnModel.insertMany(
      DEFAULT_COLUMNS.map((column, index) => ({
        boardId: board._id,
        name: column.name,
        position: index,
        isDone: column.isDone
      }))
    );

    res.status(201).json({ id: board._id.toString(), name: board.name });
  })
);

projectsRouter.post(
  '/:projectId/releases',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const teamId = await teamIdFromProject(projectId);
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin']);

    const name = readString(req.body, 'name');
    const nameNormalized = normalizeName(name);

    const exists = await ReleaseModel.findOne({
      projectId: asObjectId(projectId),
      nameNormalized
    }).lean();

    if (exists) {
      throw new AppError(409, 'Название релиза уже занято');
    }

    const release = await ReleaseModel.create({
      projectId: asObjectId(projectId),
      name,
      nameNormalized,
      date: readOptionalDate(req.body, 'date') ?? null,
      status: 'planned'
    });

    res.status(201).json({
      id: release._id.toString(),
      name: release.name,
      date: release.date,
      status: release.status
    });
  })
);

projectsRouter.get(
  '/:projectId',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const teamId = await teamIdFromProject(projectId);
    const membership = await requireMembership(teamId, req.userId);
    const project = await ProjectModel.findById(asObjectId(projectId)).lean();

    if (!project) {
      throw new AppError(404, 'Проект не найден');
    }

    const boards = await BoardModel.find({ projectId: project._id }).lean();
    const columns = await ColumnModel.find({
      boardId: { $in: boards.map((board) => board._id) }
    }).lean();
    const cards = await CardModel.find({
      boardId: { $in: boards.map((board) => board._id) }
    }).lean();
    const releases = await ReleaseModel.find({ projectId: project._id }).lean();
    const members = await TeamMemberModel.find({ teamId: project.teamId }).lean();
    const users = await UserModel.find({
      _id: { $in: members.map((item) => item.userId) }
    }).lean();
    const personalRates = await ProjectMemberRateModel.find({
      projectId: project._id
    }).lean();
    const fact = await projectFact(projectId);
    const remainder = project.budgetLimit - fact;

    const canSeeBudget =
      membership.role === 'owner' || membership.role === 'admin';
    const canSeeRates =
      membership.role === 'owner' || membership.role === 'admin';

    const rates = members.map((member) => {
      const personal = personalRates.find(
        (item) => item.userId.toString() === member.userId.toString()
      );
      const user = users.find(
        (item) => item._id.toString() === member.userId.toString()
      );
      const amount = resolveRate({
        roleRates: project.roleRates,
        personalAmount: personal ? personal.amount : null,
        role: member.role
      });
      const source = personal ? 'personal' : 'role';

      return {
        userId: member.userId.toString(),
        displayName: user?.displayName ?? '',
        role: member.role,
        source,
        amount: canSeeRates ? amount : undefined
      };
    });

    res.json({
      id: project._id.toString(),
      teamId,
      name: project.name,
      role: membership.role,
      budgetLimit: canSeeBudget ? project.budgetLimit : undefined,
      fact: canSeeBudget ? fact : undefined,
      remainder:
        canSeeBudget || membership.role === 'member' ? remainder : undefined,
      roleRates: canSeeRates ? project.roleRates : undefined,
      rates: canSeeRates ? rates : rates.map(({ amount: _a, source: _s, ...rest }) => rest),
      boards: boards.map((board) => ({
        id: board._id.toString(),
        name: board.name,
        columnCount: columns.filter(
          (column) => column.boardId.toString() === board._id.toString()
        ).length,
        cardCount: cards.filter(
          (card) => card.boardId.toString() === board._id.toString()
        ).length
      })),
      releases: releases.map((release) => ({
        id: release._id.toString(),
        name: release.name,
        date: release.date,
        status: release.status,
        cardCount: cards.filter(
          (card) => card.releaseId?.toString() === release._id.toString()
        ).length
      }))
    });
  })
);

projectsRouter.patch(
  '/:projectId',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const teamId = await teamIdFromProject(projectId);
    const membership = await requireMembership(teamId, req.userId);
    const project = await ProjectModel.findById(asObjectId(projectId));

    if (!project) {
      throw new AppError(404, 'Проект не найден');
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : undefined;

    if (name) {
      assertRole(membership.role, ['owner', 'admin']);
      project.name = name;
    }

    if (req.body?.budgetLimit !== undefined) {
      assertRole(membership.role, ['owner'], 'Бюджет меняет только Owner');
      project.budgetLimit = readBudget(req.body, 'budgetLimit');
    }

    await project.save();
    res.json({
      id: project._id.toString(),
      name: project.name,
      budgetLimit: project.budgetLimit
    });
  })
);

projectsRouter.delete(
  '/:projectId',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const teamId = await teamIdFromProject(projectId);
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin']);
    await deleteProjectCascade(asObjectId(projectId));
    res.json({ ok: true });
  })
);

projectsRouter.put(
  '/:projectId/role-rates',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const teamId = await teamIdFromProject(projectId);
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin']);

    const project = await ProjectModel.findById(asObjectId(projectId));

    if (!project) {
      throw new AppError(404, 'Проект не найден');
    }

    const roles: TeamRole[] = ['owner', 'admin', 'member', 'viewer'];

    for (const role of roles) {
      const value = readNumber(req.body, role);

      if (value < 0) {
        throw new AppError(400, 'Ставка не может быть отрицательной');
      }

      project.roleRates[role] = value;
    }

    await project.save();

    for (const role of roles) {
      await recalcRolePlans(project._id, role);
    }

    res.json({ roleRates: project.roleRates });
  })
);

projectsRouter.put(
  '/:projectId/member-rates',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const teamId = await teamIdFromProject(projectId);
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin']);

    const userId = readString(req.body, 'userId');
    const amount = readOptionalNumber(req.body, 'amount');
    const projectOid = asObjectId(projectId);
    const userOid = asObjectId(userId, 'userId');

    if (amount === undefined) {
      await ProjectMemberRateModel.deleteOne({
        projectId: projectOid,
        userId: userOid
      });
    } else {
      if (amount < 0) {
        throw new AppError(400, 'Ставка не может быть отрицательной');
      }

      await ProjectMemberRateModel.findOneAndUpdate(
        { projectId: projectOid, userId: userOid },
        { $set: { amount } },
        { upsert: true }
      );
    }

    await recalcAssigneePlans(projectOid, userOid);
    res.json({ ok: true });
  })
);

