import { Router } from 'express';
import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireMembership } from '../middleware/access.js';
import { InviteModel } from '../models/invite.js';
import { ProjectModel } from '../models/project.js';
import { TeamModel } from '../models/team.js';
import { TeamMemberModel } from '../models/team-member.js';
import { UserModel } from '../models/user.js';
import { deleteTeamCascade, unassignUserInTeam } from '../services/cascade.js';
import { createDefaultBoard } from '../services/project-setup.js';
import { DEFAULT_ROLE_RATES } from '../constants.js';
import {
  createInviteToken,
  hashToken
} from '../utils/crypto.js';
import {
  asObjectId,
  assertRole,
  readBudget,
  readInviteRole,
  readOptionalNumber,
  readString,
  readTeamRole
} from '../utils/validate.js';
import type { TeamRole } from '../constants.js';

export const teamsRouter = Router();
teamsRouter.use(requireAuth);

function canManageMember(actor: TeamRole, target: TeamRole): boolean {
  if (actor === 'owner') {
    return target !== 'owner';
  }

  if (actor === 'admin') {
    return target === 'member' || target === 'viewer';
  }

  return false;
}

teamsRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const memberships = await TeamMemberModel.find({
      userId: asObjectId(req.userId)
    }).lean();
    const teamIds = memberships.map((item) => item.teamId);
    const teams = await TeamModel.find({ _id: { $in: teamIds } }).lean();
    const projects = await ProjectModel.find({
      teamId: { $in: teamIds }
    }).lean();
    const allMembers = await TeamMemberModel.find({
      teamId: { $in: teamIds }
    }).lean();

    res.json(
      teams.map((team) => {
        const membership = memberships.find(
          (item) => item.teamId.toString() === team._id.toString()
        );

        return {
          id: team._id.toString(),
          name: team.name,
          role: membership?.role ?? 'viewer',
          memberCount: allMembers.filter(
            (item) => item.teamId.toString() === team._id.toString()
          ).length,
          projectCount: projects.filter(
            (item) => item.teamId.toString() === team._id.toString()
          ).length
        };
      })
    );
  })
);

teamsRouter.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const name = readString(req.body, 'name');
    const team = await TeamModel.create({ name });

    await TeamMemberModel.create({
      teamId: team._id,
      userId: asObjectId(req.userId),
      role: 'owner'
    });

    res.status(201).json({ id: team._id.toString(), name: team.name, role: 'owner' });
  })
);

teamsRouter.post(
  '/:teamId/projects',
  asyncHandler(async (req: Request, res: Response) => {
    const teamId = req.params.teamId as string;
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin']);

    const name = readString(req.body, 'name');
    let budgetLimit = 0;

    if (membership.role === 'owner') {
      const raw = readOptionalNumber(req.body, 'budgetLimit');
      budgetLimit = raw === undefined ? 0 : readBudget(req.body, 'budgetLimit');
    }

    const project = await ProjectModel.create({
      teamId: asObjectId(teamId),
      name,
      budgetLimit,
      roleRates: DEFAULT_ROLE_RATES
    });

    await createDefaultBoard(project._id);

    res.status(201).json({
      id: project._id.toString(),
      name: project.name,
      budgetLimit: project.budgetLimit
    });
  })
);

teamsRouter.get(
  '/:teamId',
  asyncHandler(async (req: Request, res: Response) => {
    const teamId = req.params.teamId as string;
    const membership = await requireMembership(teamId, req.userId);
    const team = await TeamModel.findById(asObjectId(teamId)).lean();

    if (!team) {
      throw new AppError(404, 'Команда не найдена');
    }

    const members = await TeamMemberModel.find({
      teamId: team._id
    }).lean();
    const users = await UserModel.find({
      _id: { $in: members.map((item) => item.userId) }
    }).lean();
    const userMap = new Map(users.map((user) => [user._id.toString(), user]));

    const projects = await ProjectModel.find({ teamId: team._id }).lean();
    const invites = await InviteModel.find({
      teamId: team._id,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { $gt: new Date() }
    }).lean();

    const canSeeBudget =
      membership.role === 'owner' || membership.role === 'admin';

    res.json({
      id: team._id.toString(),
      name: team.name,
      role: membership.role,
      members: members.map((item) => {
        const user = userMap.get(item.userId.toString());

        return {
          userId: item.userId.toString(),
          role: item.role,
          displayName: user?.displayName ?? '',
          email: user?.email ?? '',
          avatarUrl: user?.avatarUrl ?? ''
        };
      }),
      projects: projects.map((project) => ({
        id: project._id.toString(),
        name: project.name,
        budgetLimit: canSeeBudget ? project.budgetLimit : undefined
      })),
      invites:
        membership.role === 'owner' || membership.role === 'admin'
          ? invites.map((invite) => ({
              id: invite._id.toString(),
              role: invite.role,
              expiresAt: invite.expiresAt
            }))
          : []
    });
  })
);

teamsRouter.delete(
  '/:teamId',
  asyncHandler(async (req: Request, res: Response) => {
    const teamId = req.params.teamId as string;
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner']);

    const team = await TeamModel.findById(asObjectId(teamId)).lean();

    if (!team) {
      throw new AppError(404, 'Команда не найдена');
    }

    const confirmName = readString(req.body, 'confirmName');

    if (confirmName !== team.name) {
      throw new AppError(400, 'Введите название команды');
    }

    await deleteTeamCascade(team._id);
    res.json({ ok: true });
  })
);

teamsRouter.post(
  '/:teamId/transfer',
  asyncHandler(async (req: Request, res: Response) => {
    const teamId = req.params.teamId as string;
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner']);

    const targetUserId = readString(req.body, 'userId');

    if (targetUserId === req.userId) {
      throw new AppError(400, 'Нельзя передать Owner самому себе');
    }

    const target = await TeamMemberModel.findOne({
      teamId: asObjectId(teamId),
      userId: asObjectId(targetUserId, 'userId')
    });

    if (!target) {
      throw new AppError(404, 'Участник не найден');
    }

    target.role = 'owner';
    await target.save();

    await TeamMemberModel.updateOne(
      { teamId: asObjectId(teamId), userId: asObjectId(req.userId) },
      { $set: { role: 'admin' } }
    );

    res.json({ ok: true });
  })
);

teamsRouter.patch(
  '/:teamId/members/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const teamId = req.params.teamId as string;
    const targetUserId = req.params.userId as string;
    const membership = await requireMembership(teamId, req.userId);
    const nextRole = readTeamRole(req.body, 'role');

    if (nextRole === 'owner') {
      throw new AppError(400, 'Owner передаётся отдельным действием');
    }

    const target = await TeamMemberModel.findOne({
      teamId: asObjectId(teamId),
      userId: asObjectId(targetUserId, 'userId')
    });

    if (!target) {
      throw new AppError(404, 'Участник не найден');
    }

    if (!canManageMember(membership.role, target.role)) {
      throw new AppError(403, 'Недостаточно прав');
    }

    target.role = nextRole;
    await target.save();
    res.json({ ok: true, role: nextRole });
  })
);

teamsRouter.delete(
  '/:teamId/members/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const teamId = req.params.teamId as string;
    const targetUserId = req.params.userId as string;
    const membership = await requireMembership(teamId, req.userId);
    const isSelf = targetUserId === req.userId;

    const target = await TeamMemberModel.findOne({
      teamId: asObjectId(teamId),
      userId: asObjectId(targetUserId, 'userId')
    });

    if (!target) {
      throw new AppError(404, 'Участник не найден');
    }

    if (isSelf) {
      if (membership.role === 'owner') {
        throw new AppError(400, 'Сначала передайте Owner');
      }
    } else if (!canManageMember(membership.role, target.role)) {
      throw new AppError(403, 'Недостаточно прав');
    }

    await unassignUserInTeam(asObjectId(teamId), target.userId);
    await target.deleteOne();
    res.json({ ok: true });
  })
);

teamsRouter.post(
  '/:teamId/invites',
  asyncHandler(async (req: Request, res: Response) => {
    const teamId = req.params.teamId as string;
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin']);

    const role = readInviteRole(req.body, 'role');
    const raw = createInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await InviteModel.create({
      teamId: asObjectId(teamId),
      tokenHash: hashToken(raw),
      role,
      createdBy: asObjectId(req.userId),
      expiresAt
    });

    res.status(201).json({
      id: invite._id.toString(),
      token: raw,
      role: invite.role,
      expiresAt: invite.expiresAt
    });
  })
);

teamsRouter.delete(
  '/:teamId/invites/:inviteId',
  asyncHandler(async (req: Request, res: Response) => {
    const teamId = req.params.teamId as string;
    const inviteId = req.params.inviteId as string;
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin']);

    const invite = await InviteModel.findOne({
      _id: asObjectId(inviteId, 'inviteId'),
      teamId: asObjectId(teamId)
    });

    if (!invite || invite.acceptedAt || invite.revokedAt) {
      throw new AppError(404, 'Инвайт не найден');
    }

    invite.revokedAt = new Date();
    await invite.save();
    res.json({ ok: true });
  })
);
