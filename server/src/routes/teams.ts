import { Router } from 'express';
import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireMembership } from '../middleware/access.js';
import { ActivityEventModel } from '../models/activity-event.js';
import { BoardModel } from '../models/board.js';
import { CardModel } from '../models/card.js';
import { ColumnModel } from '../models/column.js';
import { CommentModel } from '../models/comment.js';
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
import { addDays, startOfDay } from '../utils/dates.js';
import {
  asObjectId,
  assertRole,
  isFeatureOn,
  readBudget,
  readInviteRole,
  readOptionalNumber,
  readString,
  readTeamRole
} from '../utils/validate.js';
import type { TeamRole } from '../constants.js';

export const teamsRouter = Router();
teamsRouter.use(requireAuth);

const ACTIVITY_DETAIL_MAX = 120;
const ACTIVITY_LIMIT = 10;
const OVERVIEW_LIST_LIMIT = 10;

function truncateDetail(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length <= ACTIVITY_DETAIL_MAX) {
    return trimmed;
  }

  return `${trimmed.slice(0, ACTIVITY_DETAIL_MAX - 1)}…`;
}

function compareDueDate(
  left: Date | null | undefined,
  right: Date | null | undefined
): number {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return left.getTime() - right.getTime();
}

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
      roleRates: DEFAULT_ROLE_RATES,
      releasesEnabled: false,
      budgetEnabled: false
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
  '/:teamId/overview',
  asyncHandler(async (req: Request, res: Response) => {
    const teamId = req.params.teamId as string;
    await requireMembership(teamId, req.userId);
    const teamObjectId = asObjectId(teamId);
    const userId = req.userId;

    const projects = await ProjectModel.find({ teamId: teamObjectId }).lean();
    const projectMap = new Map(
      projects.map((project) => [project._id.toString(), project.name])
    );
    const boards = await BoardModel.find({
      projectId: { $in: projects.map((project) => project._id) }
    }).lean();
    const boardIds = boards.map((board) => board._id);
    const boardProjectMap = new Map(
      boards.map((board) => [
        board._id.toString(),
        board.projectId.toString()
      ])
    );

    const events = await ActivityEventModel.find({
      teamId: teamObjectId,
      kind: { $ne: 'comment_added' }
    })
      .sort({ createdAt: -1 })
      .limit(ACTIVITY_LIMIT)
      .lean();

    const cards = await CardModel.find({ boardId: { $in: boardIds } })
      .select({
        _id: 1,
        title: 1,
        boardId: 1,
        columnId: 1,
        assigneeId: 1,
        dueDate: 1
      })
      .lean();
    const cardMeta = new Map(
      cards.map((card) => [
        card._id.toString(),
        {
          title: card.title,
          boardId: card.boardId.toString(),
          projectId: boardProjectMap.get(card.boardId.toString()) ?? ''
        }
      ])
    );

    const comments = await CommentModel.find({
      cardId: { $in: cards.map((card) => card._id) }
    })
      .sort({ createdAt: -1 })
      .limit(ACTIVITY_LIMIT)
      .lean();

    const actorIds = [
      ...new Set([
        ...events.map((event) => event.actorId.toString()),
        ...comments.map((comment) => comment.userId.toString())
      ])
    ];
    const actors = await UserModel.find({
      _id: { $in: actorIds.map((id) => asObjectId(id)) }
    }).lean();
    const actorMap = new Map(
      actors.map((user) => [user._id.toString(), user.displayName])
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
      createdAt: event.createdAt
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
          createdAt: comment.createdAt
        }
      ];
    });

    const activity = [...activityFromEvents, ...activityFromComments]
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      )
      .slice(0, ACTIVITY_LIMIT);

    const columns = await ColumnModel.find({
      boardId: { $in: boardIds }
    }).lean();
    const doneColumnIds = new Set(
      columns
        .filter((column) => column.isDone)
        .map((column) => column._id.toString())
    );

    const today = startOfDay(new Date());
    const dueLimit = addDays(today, 7);

    const openCards = cards.filter(
      (card) => !doneColumnIds.has(card.columnId.toString())
    );

    const isOverdue = (dueDate: Date | null | undefined): boolean =>
      Boolean(dueDate && startOfDay(dueDate) < today);

    const isDueSoon = (dueDate: Date | null | undefined): boolean =>
      Boolean(
        dueDate &&
          startOfDay(dueDate) >= today &&
          startOfDay(dueDate) < dueLimit
      );

    const resolveStatus = (
      dueDate: Date | null | undefined
    ): 'overdue' | 'dueSoon' | 'open' => {
      if (isOverdue(dueDate)) {
        return 'overdue';
      }

      if (isDueSoon(dueDate)) {
        return 'dueSoon';
      }

      return 'open';
    };

    const toCardItem = (card: (typeof cards)[number]) => {
      const projectId = boardProjectMap.get(card.boardId.toString()) ?? '';

      return {
        cardId: card._id.toString(),
        title: card.title,
        dueDate: card.dueDate,
        boardId: card.boardId.toString(),
        projectId,
        projectName: projectMap.get(projectId) ?? '',
        status: resolveStatus(card.dueDate)
      };
    };

    const dueSoon = openCards
      .filter((card) => card.dueDate && startOfDay(card.dueDate) < dueLimit)
      .sort((left, right) => compareDueDate(left.dueDate, right.dueDate))
      .slice(0, OVERVIEW_LIST_LIMIT)
      .map((card) => {
        const projectId = boardProjectMap.get(card.boardId.toString()) ?? '';
        const dueDate = card.dueDate as Date;

        return {
          cardId: card._id.toString(),
          title: card.title,
          dueDate,
          boardId: card.boardId.toString(),
          projectId,
          projectName: projectMap.get(projectId) ?? '',
          status: isOverdue(dueDate) ? 'overdue' : 'dueSoon'
        };
      });

    const myTasks = openCards
      .filter((card) => card.assigneeId?.toString() === userId)
      .sort((left, right) => compareDueDate(left.dueDate, right.dueDate))
      .slice(0, OVERVIEW_LIST_LIMIT)
      .map(toCardItem);

    const unassigned = openCards
      .filter((card) => !card.assigneeId)
      .sort((left, right) => compareDueDate(left.dueDate, right.dueDate))
      .slice(0, OVERVIEW_LIST_LIMIT)
      .map(toCardItem);

    res.json({
      activity,
      dueSoon,
      myTasks,
      unassigned
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
        budgetEnabled: isFeatureOn(project.budgetEnabled),
        budgetLimit:
          canSeeBudget && isFeatureOn(project.budgetEnabled)
            ? project.budgetLimit
            : undefined
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

    await deleteTeamCascade(team._id);
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
      throw new AppError(400, 'Нельзя назначить роль Owner');
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
        throw new AppError(400, 'Owner не может выйти из команды');
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
