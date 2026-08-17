import { Router } from 'express';
import type { Request, Response } from 'express';
import type { TeamRole } from '../constants.js';
import { AppError } from '../errors/app-error.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import {
  canManageProjectMember,
  canManageProjectMembers,
  requireProjectAccess,
} from '../middleware/access.js';
import { BoardModel } from '../models/board.js';
import { CardModel } from '../models/card.js';
import { ProjectModel } from '../models/project.js';
import { ProjectMemberModel } from '../models/project-member.js';
import { ProjectMemberRateModel } from '../models/project-member-rate.js';
import { ReleaseModel } from '../models/release.js';
import { TeamMemberModel } from '../models/team-member.js';
import { TimeEntryModel } from '../models/time-entry.js';
import { UserModel } from '../models/user.js';
import {
  deleteProjectCascade,
  unassignUserInProject,
} from '../services/cascade.js';
import { recalcAssigneePlans, recalcRolePlans } from '../services/plan.js';
import {
  createDefaultBoard,
  resolveProjectBoard,
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
  readNonOwnerRole,
  readNumber,
  readOptionalDate,
  readOptionalNumber,
  readString,
} from '../utils/validate.js';

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

async function projectFact(projectId: string): Promise<number> {
  const boards = await BoardModel.find({
    projectId: asObjectId(projectId),
  }).lean();
  const cards = await CardModel.find({
    boardId: { $in: boards.map((board) => board._id) },
  }).lean();
  const entries = await TimeEntryModel.find({
    cardId: { $in: cards.map((card) => card._id) },
  }).lean();

  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}

projectsRouter.post(
  '/:projectId/releases',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const access = await requireProjectAccess(projectId, req.userId);
    assertRole(access.role, ['owner', 'admin']);

    const project = await ProjectModel.findById(asObjectId(projectId)).lean();

    if (!project) {
      throw new AppError(404, 'Проект не найден');
    }

    assertFeatureOn(project.releasesEnabled, 'Релизы выключены в проекте');

    const name = readString(req.body, 'name');
    const nameNormalized = normalizeName(name);

    const exists = await ReleaseModel.findOne({
      projectId: asObjectId(projectId),
      nameNormalized,
    }).lean();

    if (exists) {
      throw new AppError(409, 'Название релиза уже занято');
    }

    const release = await ReleaseModel.create({
      projectId: asObjectId(projectId),
      name,
      nameNormalized,
      date: readOptionalDate(req.body, 'date') ?? null,
      status: 'planned',
    });

    res.status(201).json({
      id: release._id.toString(),
      name: release.name,
      date: release.date,
      status: release.status,
    });
  }),
);

projectsRouter.get(
  '/:projectId',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const access = await requireProjectAccess(projectId, req.userId);
    const project = await ProjectModel.findById(asObjectId(projectId)).lean();

    if (!project) {
      throw new AppError(404, 'Проект не найден');
    }

    const board = await resolveProjectBoard(project._id);
    const cards = await CardModel.find({ boardId: board._id }).lean();
    const releases = await ReleaseModel.find({ projectId: project._id }).lean();
    const members = await ProjectMemberModel.find({
      projectId: project._id,
    }).lean();
    const users = await UserModel.find({
      _id: { $in: members.map((item) => item.userId) },
    }).lean();
    const personalRates = await ProjectMemberRateModel.find({
      projectId: project._id,
    }).lean();
    const fact = await projectFact(projectId);
    const remainder = project.budgetLimit - fact;
    const releasesEnabled = isFeatureOn(project.releasesEnabled);
    const budgetEnabled = isFeatureOn(project.budgetEnabled);

    const canSeeBudget = budgetEnabled
      && (access.role === 'owner' || access.role === 'admin');
    const canSeeRates = access.role === 'owner' || access.role === 'admin';
    const canSeeRemainder = budgetEnabled
      && (canSeeBudget || access.role === 'member');

    const rates = members.map((member) => {
      const personal = personalRates.find(
        (item) => item.userId.toString() === member.userId.toString(),
      );
      const user = users.find(
        (item) => item._id.toString() === member.userId.toString(),
      );
      const amount = resolveRate({
        roleRates: project.roleRates,
        personalAmount: personal ? personal.amount : null,
        role: member.role,
      });
      const source = personal ? 'personal' : 'role';

      return {
        userId: member.userId.toString(),
        displayName: user?.displayName ?? '',
        role: member.role,
        source,
        amount: canSeeRates ? amount : undefined,
      };
    });

    res.json({
      id: project._id.toString(),
      teamId: access.teamId,
      name: project.name,
      role: access.role,
      teamRole: access.teamRole,
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
            (card) => card.releaseId?.toString() === release._id.toString(),
          ).length,
        }))
        : [],
    });
  }),
);

projectsRouter.patch(
  '/:projectId',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const access = await requireProjectAccess(projectId, req.userId);
    const project = await ProjectModel.findById(asObjectId(projectId));

    if (!project) {
      throw new AppError(404, 'Проект не найден');
    }

    if (req.body?.name !== undefined) {
      assertRole(access.role, ['owner', 'admin']);
      project.name = readString(req.body, 'name');
    }

    if (req.body?.releasesEnabled !== undefined) {
      assertRole(access.role, ['owner', 'admin']);
      project.releasesEnabled = readBoolean(req.body, 'releasesEnabled');
    }

    if (req.body?.budgetEnabled !== undefined) {
      assertRole(access.role, ['owner', 'admin']);
      project.budgetEnabled = readBoolean(req.body, 'budgetEnabled');
    }

    if (req.body?.budgetLimit !== undefined) {
      assertRole(access.role, ['owner'], 'Бюджет меняет только Owner');
      assertFeatureOn(project.budgetEnabled, 'Бюджет выключен в проекте');
      project.budgetLimit = readBudget(req.body, 'budgetLimit');
    }

    if (req.body?.boardBackground !== undefined) {
      assertRole(access.role, ['owner', 'admin']);
      project.boardBackground = readBoardBackground(req.body, 'boardBackground');
    }

    await project.save();
    res.json({
      id: project._id.toString(),
      name: project.name,
      budgetLimit: project.budgetLimit,
      releasesEnabled: project.releasesEnabled,
      budgetEnabled: project.budgetEnabled,
      boardBackground: project.boardBackground,
    });
  }),
);

projectsRouter.post(
  '/:projectId/duplicate',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const access = await requireProjectAccess(projectId, req.userId);
    assertRole(access.role, ['owner', 'admin']);

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
      boardBackground: source.boardBackground,
    });

    await createDefaultBoard(project._id);

    const sourceMembers = await ProjectMemberModel.find({
      projectId: source._id,
    }).lean();

    if (sourceMembers.length > 0) {
      await ProjectMemberModel.insertMany(
        sourceMembers.map((member) => ({
          projectId: project._id,
          userId: member.userId,
          role: member.role,
        })),
      );
    }

    const memberRates = await ProjectMemberRateModel.find({
      projectId: source._id,
    }).lean();

    if (memberRates.length > 0) {
      await ProjectMemberRateModel.insertMany(
        memberRates.map((rate) => ({
          projectId: project._id,
          userId: rate.userId,
          amount: rate.amount,
        })),
      );
    }

    res.status(201).json({ id: project._id.toString() });
  }),
);

projectsRouter.delete(
  '/:projectId',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const access = await requireProjectAccess(projectId, req.userId);
    assertRole(access.role, ['owner', 'admin']);

    const project = await ProjectModel.findById(asObjectId(projectId)).lean();

    if (!project) {
      throw new AppError(404, 'Проект не найден');
    }

    await deleteProjectCascade(project._id);
    res.json({ ok: true });
  }),
);

projectsRouter.put(
  '/:projectId/role-rates',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const access = await requireProjectAccess(projectId, req.userId);
    assertRole(access.role, ['owner', 'admin']);

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

    await Promise.all(
      roles.map((role) => recalcRolePlans(project._id, role)),
    );

    res.json({ roleRates: project.roleRates });
  }),
);

projectsRouter.put(
  '/:projectId/member-rates',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const access = await requireProjectAccess(projectId, req.userId);
    assertRole(access.role, ['owner', 'admin']);

    const userId = readString(req.body, 'userId');
    const amount = readOptionalNumber(req.body, 'amount');
    const projectOid = asObjectId(projectId);
    const userOid = asObjectId(userId, 'userId');
    const projectMember = await ProjectMemberModel.findOne({
      projectId: projectOid,
      userId: userOid,
    }).lean();

    if (!projectMember) {
      throw new AppError(400, 'Пользователь не в составе проекта');
    }

    if (amount === undefined) {
      await ProjectMemberRateModel.deleteOne({
        projectId: projectOid,
        userId: userOid,
      });
    } else {
      if (amount < 0) {
        throw new AppError(400, 'Ставка не может быть отрицательной');
      }

      await ProjectMemberRateModel.findOneAndUpdate(
        { projectId: projectOid, userId: userOid },
        { $set: { amount } },
        { upsert: true },
      );
    }

    await recalcAssigneePlans(projectOid, userOid);
    res.json({ ok: true });
  }),
);

projectsRouter.get(
  '/:projectId/members',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const access = await requireProjectAccess(projectId, req.userId);
    const project = await ProjectModel.findById(asObjectId(projectId)).lean();

    if (!project) {
      throw new AppError(404, 'Проект не найден');
    }

    const members = await ProjectMemberModel.find({
      projectId: project._id,
    }).lean();
    const teamMembers = await TeamMemberModel.find({
      teamId: project.teamId,
    }).lean();
    const users = await UserModel.find({
      _id: { $in: teamMembers.map((item) => item.userId) },
    }).lean();
    const userMap = new Map(users.map((user) => [user._id.toString(), user]));
    const memberIds = new Set(members.map((item) => item.userId.toString()));

    res.json({
      role: access.role,
      teamRole: access.teamRole,
      members: members.map((item) => {
        const user = userMap.get(item.userId.toString());

        return {
          userId: item.userId.toString(),
          role: item.role,
          displayName: user?.displayName ?? '',
          email: user?.email ?? '',
          avatarUrl: user?.avatarUrl ?? '',
        };
      }),
      candidates: teamMembers
        .filter((item) => !memberIds.has(item.userId.toString()))
        .map((item) => {
          const user = userMap.get(item.userId.toString());

          return {
            userId: item.userId.toString(),
            displayName: user?.displayName ?? '',
            email: user?.email ?? '',
            avatarUrl: user?.avatarUrl ?? '',
          };
        }),
    });
  }),
);

projectsRouter.post(
  '/:projectId/members',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const access = await requireProjectAccess(projectId, req.userId);

    if (!canManageProjectMembers(access)) {
      throw new AppError(403, 'Недостаточно прав');
    }

    const userId = readString(req.body, 'userId');
    const role = readNonOwnerRole(req.body, 'role');
    const projectOid = asObjectId(projectId);
    const userOid = asObjectId(userId, 'userId');
    const project = await ProjectModel.findById(projectOid).lean();

    if (!project) {
      throw new AppError(404, 'Проект не найден');
    }

    const teamMember = await TeamMemberModel.findOne({
      teamId: project.teamId,
      userId: userOid,
    }).lean();

    if (!teamMember) {
      throw new AppError(400, 'Пользователь не в команде');
    }

    if (!canManageProjectMember(access, role)) {
      throw new AppError(403, 'Недостаточно прав');
    }

    const existing = await ProjectMemberModel.findOne({
      projectId: projectOid,
      userId: userOid,
    }).lean();

    if (existing) {
      throw new AppError(409, 'Участник уже в проекте');
    }

    await ProjectMemberModel.create({
      projectId: projectOid,
      userId: userOid,
      role,
    });

    res.status(201).json({ ok: true, role });
  }),
);

projectsRouter.patch(
  '/:projectId/members/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const targetUserId = req.params.userId as string;
    const access = await requireProjectAccess(projectId, req.userId);
    const nextRole = readNonOwnerRole(req.body, 'role');
    const target = await ProjectMemberModel.findOne({
      projectId: asObjectId(projectId),
      userId: asObjectId(targetUserId, 'userId'),
    });

    if (!target) {
      throw new AppError(404, 'Участник не найден');
    }

    if (!canManageProjectMember(access, target.role)
      || !canManageProjectMember(access, nextRole)) {
      throw new AppError(403, 'Недостаточно прав');
    }

    const roleChanged = target.role !== nextRole;
    target.role = nextRole;
    await target.save();

    if (roleChanged) {
      await recalcAssigneePlans(target.projectId, target.userId);
    }

    res.json({ ok: true, role: nextRole });
  }),
);

projectsRouter.delete(
  '/:projectId/members/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const targetUserId = req.params.userId as string;
    const access = await requireProjectAccess(projectId, req.userId);
    const isSelf = targetUserId === req.userId;
    const target = await ProjectMemberModel.findOne({
      projectId: asObjectId(projectId),
      userId: asObjectId(targetUserId, 'userId'),
    });

    if (!target) {
      throw new AppError(404, 'Участник не найден');
    }

    if (isSelf) {
      if (target.role === 'owner') {
        throw new AppError(400, 'Owner не может выйти из проекта');
      }
    } else if (!canManageProjectMember(access, target.role)) {
      throw new AppError(403, 'Недостаточно прав');
    }

    await unassignUserInProject(target.projectId, target.userId);
    await target.deleteOne();
    res.json({ ok: true });
  }),
);
