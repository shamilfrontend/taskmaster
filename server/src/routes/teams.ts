import { Router } from 'express';
import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireMembership, listAccessibleProjectIds } from '../middleware/access.js';
import { ActivityEventModel } from '../models/activity-event.js';
import { BoardModel } from '../models/board.js';
import { CardModel } from '../models/card.js';
import { CommentModel } from '../models/comment.js';
import { InviteModel } from '../models/invite.js';
import { ProjectModel } from '../models/project.js';
import { ProjectMemberModel } from '../models/project-member.js';
import { TeamModel } from '../models/team.js';
import { TeamMemberModel } from '../models/team-member.js';
import { UserModel } from '../models/user.js';
import { deleteTeamCascade, unassignUserInTeam } from '../services/cascade.js';
import { createDefaultBoard } from '../services/project-setup.js';
import { importTrelloBoard } from '../services/trello-import.js';
import {
  createInviteToken,
  hashToken,
} from '../utils/crypto.js';
import { canManageMember } from '../utils/roles.js';
import {
  asObjectId,
  assertRole,
  readInviteRole,
  readString,
  readTeamRole,
} from '../utils/validate.js';

export const teamsRouter = Router();
teamsRouter.use(requireAuth);

const ACTIVITY_DETAIL_MAX = 120;
const ACTIVITY_LIMIT = 10;

function truncateDetail(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length <= ACTIVITY_DETAIL_MAX) {
    return trimmed;
  }

  return `${trimmed.slice(0, ACTIVITY_DETAIL_MAX - 1)}…`;
}

function readActivityBefore(query: Request['query']): Date | undefined {
  const raw = query.before;

  if (typeof raw !== 'string' || !raw) {
    return undefined;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, 'Некорректная дата before');
  }

  return date;
}

teamsRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const memberships = await TeamMemberModel.find({
      userId: asObjectId(req.userId),
    }).lean();
    const teamIds = memberships.map((item) => item.teamId);
    const teams = await TeamModel.find({ _id: { $in: teamIds } }).lean();
    const projects = await ProjectModel.find({
      teamId: { $in: teamIds },
    }).lean();
    const allMembers = await TeamMemberModel.find({
      teamId: { $in: teamIds },
    }).lean();
    const projectMemberships = await ProjectMemberModel.find({
      userId: asObjectId(req.userId),
      projectId: { $in: projects.map((project) => project._id) },
    })
      .select('projectId')
      .lean();
    const memberProjectIds = new Set(
      projectMemberships.map((item) => item.projectId.toString()),
    );

    res.json(
      teams.map((team) => {
        const membership = memberships.find(
          (item) => item.teamId.toString() === team._id.toString(),
        );
        const teamProjects = projects.filter(
          (item) => item.teamId.toString() === team._id.toString(),
        );
        const accessibleCount = membership?.role === 'owner'
          ? teamProjects.length
          : teamProjects.filter((item) => memberProjectIds.has(item._id.toString()))
            .length;

        return {
          id: team._id.toString(),
          name: team.name,
          role: membership?.role ?? 'viewer',
          memberCount: allMembers.filter(
            (item) => item.teamId.toString() === team._id.toString(),
          ).length,
          projectCount: accessibleCount,
        };
      }),
    );
  }),
);

teamsRouter.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const name = readString(req.body, 'name');
    const team = await TeamModel.create({ name });

    await TeamMemberModel.create({
      teamId: team._id,
      userId: asObjectId(req.userId),
      role: 'owner',
    });

    res.status(201).json({ id: team._id.toString(), name: team.name, role: 'owner' });
  }),
);

teamsRouter.post(
  '/:teamId/projects',
  asyncHandler(async (req: Request, res: Response) => {
    const teamId = req.params.teamId as string;
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin']);

    const name = readString(req.body, 'name');

    const project = await ProjectModel.create({
      teamId: asObjectId(teamId),
      name,
      releasesEnabled: false,
    });

    await createDefaultBoard(project._id);
    await ProjectMemberModel.create({
      projectId: project._id,
      userId: asObjectId(req.userId),
      role: 'owner',
    });

    res.status(201).json({
      id: project._id.toString(),
      name: project.name,
    });
  }),
);

teamsRouter.post(
  '/:teamId/projects/from-trello',
  asyncHandler(async (req: Request, res: Response) => {
    const teamId = req.params.teamId as string;
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin']);

    const name = readString(req.body, 'name');

    if (typeof req.body !== 'object' || req.body === null) {
      throw new AppError(400, 'Некорректное тело запроса');
    }

    const { board } = (req.body as Record<string, unknown>);
    const project = await importTrelloBoard({
      teamId: asObjectId(teamId),
      name,
      board,
      ownerId: asObjectId(req.userId),
    });

    res.status(201).json(project);
  }),
);

teamsRouter.get(
  '/:teamId/activity',
  asyncHandler(async (req: Request, res: Response) => {
    const teamId = req.params.teamId as string;
    const membership = await requireMembership(teamId, req.userId);
    const teamObjectId = asObjectId(teamId);
    const before = readActivityBefore(req.query);
    const fetchLimit = ACTIVITY_LIMIT + 1;
    const accessibleIds = await listAccessibleProjectIds(
      teamId,
      req.userId,
      membership.role,
    );

    const boards = await BoardModel.find({
      projectId: { $in: accessibleIds },
    }).lean();
    const boardIds = boards.map((board) => board._id);
    const boardProjectMap = new Map(
      boards.map((board) => [
        board._id.toString(),
        board.projectId.toString(),
      ]),
    );

    const events = await ActivityEventModel.find({
      teamId: teamObjectId,
      projectId: { $in: accessibleIds },
      kind: { $ne: 'comment_added' },
      ...(before ? { createdAt: { $lt: before } } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(fetchLimit)
      .lean();

    const cards = await CardModel.find({ boardId: { $in: boardIds } })
      .select({ _id: 1, title: 1, boardId: 1 })
      .lean();
    const cardMeta = new Map(
      cards.map((card) => [
        card._id.toString(),
        {
          title: card.title,
          boardId: card.boardId.toString(),
          projectId: boardProjectMap.get(card.boardId.toString()) ?? '',
        },
      ]),
    );

    const comments = await CommentModel.find({
      cardId: { $in: cards.map((card) => card._id) },
      ...(before ? { createdAt: { $lt: before } } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(fetchLimit)
      .lean();

    const actorIds = [
      ...new Set([
        ...events.map((event) => event.actorId.toString()),
        ...comments.map((comment) => comment.userId.toString()),
      ]),
    ];
    const actors = await UserModel.find({
      _id: { $in: actorIds.map((id) => asObjectId(id)) },
    }).lean();
    const actorMap = new Map(
      actors.map((user) => [user._id.toString(), user.displayName]),
    );

    const activityFromEvents = events.map((event) => ({
      id: event._id.toString(),
      kind: event.kind,
      cardId: event.cardId.toString(),
      cardTitle: event.cardTitle,
      detail: event.detail,
      boardId: event.boardId.toString(),
      projectId: event.projectId.toString(),
      actorId: event.actorId.toString(),
      actorName: actorMap.get(event.actorId.toString()) ?? '',
      createdAt: event.createdAt,
    }));

    const activityFromComments = comments.flatMap((comment) => {
      const card = cardMeta.get(comment.cardId.toString());

      if (!card || !card.projectId) {
        return [];
      }

      return [
        {
          id: `comment:${comment._id.toString()}`,
          kind: 'comment_added' as const,
          cardId: comment.cardId.toString(),
          cardTitle: card.title,
          detail: truncateDetail(comment.body),
          boardId: card.boardId,
          projectId: card.projectId,
          actorId: comment.userId.toString(),
          actorName: actorMap.get(comment.userId.toString()) ?? '',
          createdAt: comment.createdAt,
        },
      ];
    });

    const merged = [...activityFromEvents, ...activityFromComments].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
    const hasMore = merged.length > ACTIVITY_LIMIT;
    const items = merged.slice(0, ACTIVITY_LIMIT);

    res.json({ items, hasMore });
  }),
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
      teamId: team._id,
    }).lean();
    const users = await UserModel.find({
      _id: { $in: members.map((item) => item.userId) },
    }).lean();
    const userMap = new Map(users.map((user) => [user._id.toString(), user]));

    const projects = await ProjectModel.find({ teamId: team._id }).lean();
    const projectMembers = await ProjectMemberModel.find({
      userId: asObjectId(req.userId),
      projectId: { $in: projects.map((project) => project._id) },
    }).lean();
    const projectRoleById = new Map(
      projectMembers.map((item) => [item.projectId.toString(), item.role]),
    );
    const visibleProjects = membership.role === 'owner'
      ? projects
      : projects.filter((project) => projectRoleById.has(project._id.toString()));
    const visibleIds = visibleProjects.map((project) => project._id);
    const boards = visibleIds.length > 0
      ? await BoardModel.find({ projectId: { $in: visibleIds } })
        .select({ _id: 1, projectId: 1 })
        .lean()
      : [];
    const boardIds = boards.map((board) => board._id);
    const cardCountByBoard = new Map<string, number>();

    if (boardIds.length > 0) {
      const grouped = await CardModel.aggregate([
        { $match: { boardId: { $in: boardIds } } },
        { $group: { _id: '$boardId', count: { $sum: 1 } } },
      ]);

      for (const item of grouped) {
        cardCountByBoard.set(String(item._id), item.count);
      }
    }

    const cardCountByProject = new Map<string, number>();

    for (const board of boards) {
      const projectId = board.projectId.toString();
      const next = (cardCountByProject.get(projectId) ?? 0)
        + (cardCountByBoard.get(board._id.toString()) ?? 0);

      cardCountByProject.set(projectId, next);
    }

    const invites = await InviteModel.find({
      teamId: team._id,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    }).lean();

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
          avatarUrl: user?.avatarUrl ?? '',
        };
      }),
      projects: visibleProjects.map((project) => ({
        id: project._id.toString(),
        name: project.name,
        role: projectRoleById.get(project._id.toString())
          ?? (membership.role === 'owner' ? 'owner' : 'viewer'),
        boardBackground: project.boardBackground ?? 'default',
        cardCount: cardCountByProject.get(project._id.toString()) ?? 0,
      })),
      invites:
        membership.role === 'owner' || membership.role === 'admin'
          ? invites.map((invite) => ({
            id: invite._id.toString(),
            role: invite.role,
            expiresAt: invite.expiresAt,
          }))
          : [],
    });
  }),
);

teamsRouter.patch(
  '/:teamId',
  asyncHandler(async (req: Request, res: Response) => {
    const teamId = req.params.teamId as string;
    const membership = await requireMembership(teamId, req.userId);
    assertRole(membership.role, ['owner', 'admin']);

    const team = await TeamModel.findById(asObjectId(teamId));

    if (!team) {
      throw new AppError(404, 'Команда не найдена');
    }

    const name = readString(req.body, 'name');
    team.name = name;
    await team.save();

    res.json({ id: team._id.toString(), name: team.name });
  }),
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

    await deleteTeamCascade(team._id);
    res.json({ ok: true });
  }),
);

teamsRouter.patch(
  '/:teamId/members/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const teamId = req.params.teamId as string;
    const targetUserId = req.params.userId as string;
    const membership = await requireMembership(teamId, req.userId);
    const nextRole = readTeamRole(req.body, 'role');

    if (nextRole === 'owner') {
      throw new AppError(400, 'Нельзя назначить роль Owner');
    }

    const target = await TeamMemberModel.findOne({
      teamId: asObjectId(teamId),
      userId: asObjectId(targetUserId, 'userId'),
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
  }),
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
      userId: asObjectId(targetUserId, 'userId'),
    });

    if (!target) {
      throw new AppError(404, 'Участник не найден');
    }

    if (isSelf) {
      if (membership.role === 'owner') {
        throw new AppError(400, 'Owner не может выйти из команды');
      }
    } else if (!canManageMember(membership.role, target.role)) {
      throw new AppError(403, 'Недостаточно прав');
    }

    await unassignUserInTeam(asObjectId(teamId), target.userId);
    await target.deleteOne();
    res.json({ ok: true });
  }),
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
      expiresAt,
    });

    res.status(201).json({
      id: invite._id.toString(),
      token: raw,
      role: invite.role,
      expiresAt: invite.expiresAt,
    });
  }),
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
      teamId: asObjectId(teamId),
    });

    if (!invite || invite.acceptedAt || invite.revokedAt) {
      throw new AppError(404, 'Инвайт не найден');
    }

    invite.revokedAt = new Date();
    await invite.save();
    res.json({ ok: true });
  }),
);
