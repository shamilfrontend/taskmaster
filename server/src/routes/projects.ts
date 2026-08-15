import { Router } from 'express';
import type { Request, Response } from 'express';
import type { TeamRole } from '../constants.js';
import { AppError } from '../errors/app-error.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import {
  requireMembership,
  teamIdFromProject
} from '../middleware/access.js';
import { BoardModel } from '../models/board.js';
import { CardModel } from '../models/card.js';
import { ProjectModel } from '../models/project.js';
import { ProjectMemberRateModel } from '../models/project-member-rate.js';
import { ReleaseModel } from '../models/release.js';
import { TeamMemberModel } from '../models/team-member.js';
import { TimeEntryModel } from '../models/time-entry.js';
import { UserModel } from '../models/user.js';
import { deleteProjectCascade } from '../services/cascade.js';
import { recalcAssigneePlans, recalcRolePlans } from '../services/plan.js';
import {
  createDefaultBoard,
  resolveProjectBoard
} from '../services/project-setup.js';
import { normalizeName } from '../utils/crypto.js';
import { resolveRate } from '../utils/rates.js';
import {
  asObjectId,
  assertFeatureOn,
  assertRole,
  isFeatureOn,
  readBoolean,
  readBoardBackground,
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
  '/:projectId/releases',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const teamId = await teamIdFromProject(projectId);
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin']);

    const project = await ProjectModel.findById(asObjectId(projectId)).lean();

    if (!project) {
      throw new AppError(404, 'Проект не найден');
    }

    assertFeatureOn(project.releasesEnabled, 'Релизы выключены в проекте');

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

    const board = await resolveProjectBoard(project._id);
    const cards = await CardModel.find({ boardId: board._id }).lean();
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
    const releasesEnabled = isFeatureOn(project.releasesEnabled);
    const budgetEnabled = isFeatureOn(project.budgetEnabled);

    const canSeeBudget =
      budgetEnabled &&
      (membership.role === 'owner' || membership.role === 'admin');
    const canSeeRates =
      membership.role === 'owner' || membership.role === 'admin';
    const canSeeRemainder =
      budgetEnabled &&
      (canSeeBudget || membership.role === 'member');

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
      releasesEnabled,
      budgetEnabled,
      boardBackground: project.boardBackground ?? 'default',
      budgetLimit: canSeeBudget ? project.budgetLimit : undefined,
      fact: canSeeBudget ? fact : undefined,
      remainder: canSeeRemainder ? remainder : undefined,
      roleRates: canSeeRates ? project.roleRates : undefined,
      rates: canSeeRates ? rates : rates.map(({ amount: _a, source: _s, ...rest }) => rest),
      board: { id: board._id.toString() },
      releases: releasesEnabled
        ? releases.map((release) => ({
            id: release._id.toString(),
            name: release.name,
            date: release.date,
            status: release.status,
            cardCount: cards.filter(
              (card) => card.releaseId?.toString() === release._id.toString()
            ).length
          }))
        : []
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

    if (req.body?.releasesEnabled !== undefined) {
      assertRole(membership.role, ['owner', 'admin']);
      project.releasesEnabled = readBoolean(req.body, 'releasesEnabled');
    }

    if (req.body?.budgetEnabled !== undefined) {
      assertRole(membership.role, ['owner', 'admin']);
      project.budgetEnabled = readBoolean(req.body, 'budgetEnabled');
    }

    if (req.body?.budgetLimit !== undefined) {
      assertRole(membership.role, ['owner'], 'Бюджет меняет только Owner');
      assertFeatureOn(project.budgetEnabled, 'Бюджет выключен в проекте');
      project.budgetLimit = readBudget(req.body, 'budgetLimit');
    }

    if (req.body?.boardBackground !== undefined) {
      assertRole(membership.role, ['owner', 'admin']);
      project.boardBackground = readBoardBackground(req.body, 'boardBackground');
    }

    await project.save();
    res.json({
      id: project._id.toString(),
      name: project.name,
      budgetLimit: project.budgetLimit,
      releasesEnabled: project.releasesEnabled,
      budgetEnabled: project.budgetEnabled,
      boardBackground: project.boardBackground
    });
  })
);

projectsRouter.post(
  '/:projectId/duplicate',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const teamId = await teamIdFromProject(projectId);
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin']);

    const source = await ProjectModel.findById(asObjectId(projectId)).lean();

    if (!source) {
      throw new AppError(404, 'Проект не найден');
    }

    const project = await ProjectModel.create({
      teamId: source.teamId,
      name: `${source.name} (копия)`,
      budgetLimit: source.budgetLimit,
      budgetEnabled: source.budgetEnabled,
      releasesEnabled: source.releasesEnabled,
      roleRates: { ...source.roleRates },
      boardBackground: source.boardBackground
    });

    await createDefaultBoard(project._id);

    const memberRates = await ProjectMemberRateModel.find({
      projectId: source._id
    }).lean();

    if (memberRates.length > 0) {
      await ProjectMemberRateModel.insertMany(
        memberRates.map((rate) => ({
          projectId: project._id,
          userId: rate.userId,
          amount: rate.amount
        }))
      );
    }

    res.status(201).json({ id: project._id.toString() });
  })
);

projectsRouter.delete(
  '/:projectId',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const teamId = await teamIdFromProject(projectId);
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin']);

    const project = await ProjectModel.findById(asObjectId(projectId)).lean();

    if (!project) {
      throw new AppError(404, 'Проект не найден');
    }

    await deleteProjectCascade(project._id);
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

