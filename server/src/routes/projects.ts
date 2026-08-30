import { Router } from 'express';
import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import {
  canManageProjectMember,
  canManageProjectMembers,
  requireProjectAccess,
} from '../middleware/access.js';
import { CardModel } from '../models/card.js';
import { ProjectModel } from '../models/project.js';
import { ProjectMemberModel } from '../models/project-member.js';
import { ReleaseModel } from '../models/release.js';
import { TeamMemberModel } from '../models/team-member.js';
import { UserModel } from '../models/user.js';
import {
  deleteProjectCascade,
  unassignUserInProject,
} from '../services/cascade.js';
import { exportProject } from '../services/project-export.js';
import {
  createDefaultBoard,
  resolveProjectBoard,
} from '../services/project-setup.js';
import { normalizeName } from '../utils/crypto.js';
import {
  asObjectId,
  assertFeatureOn,
  assertRole,
  isFeatureOn,
  readBoolean,
  readBoardBackground,
  readNonOwnerRole,
  readOptionalDate,
  readString,
} from '../utils/validate.js';

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

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
    const releasesEnabled = isFeatureOn(project.releasesEnabled);
    const analyticsEnabled = isFeatureOn(project.analyticsEnabled);
    const people = members.map((member) => {
      const user = users.find(
        (item) => item._id.toString() === member.userId.toString(),
      );

      return {
        userId: member.userId.toString(),
        displayName: user?.displayName ?? '',
        role: member.role,
      };
    });

    res.json({
      id: project._id.toString(),
      teamId: access.teamId,
      name: project.name,
      role: access.role,
      teamRole: access.teamRole,
      releasesEnabled,
      analyticsEnabled,
      boardBackground: project.boardBackground ?? 'default',
      people,
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

projectsRouter.get(
  '/:projectId/export',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const access = await requireProjectAccess(projectId, req.userId);
    assertRole(access.role, ['owner', 'admin']);

    const payload = await exportProject(asObjectId(projectId));
    res.json(payload);
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

    if (req.body?.analyticsEnabled !== undefined) {
      assertRole(access.role, ['owner', 'admin']);
      project.analyticsEnabled = readBoolean(req.body, 'analyticsEnabled');
    }

    if (req.body?.boardBackground !== undefined) {
      assertRole(access.role, ['owner', 'admin']);
      project.boardBackground = readBoardBackground(req.body, 'boardBackground');
    }

    await project.save();
    res.json({
      id: project._id.toString(),
      name: project.name,
      releasesEnabled: project.releasesEnabled,
      analyticsEnabled: project.analyticsEnabled,
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
      releasesEnabled: source.releasesEnabled,
      analyticsEnabled: source.analyticsEnabled,
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

    target.role = nextRole;
    await target.save();

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
