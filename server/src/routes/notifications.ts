import { Router } from 'express';
import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { NotificationModel } from '../models/notification.js';
import { ProjectModel } from '../models/project.js';
import { TeamModel } from '../models/team.js';
import { UserModel } from '../models/user.js';
import { ensureDueNotifications } from '../services/notifications.js';
import { asObjectId } from '../utils/validate.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

const NOTIFICATION_LIMIT = 10;

function readBefore(query: Request['query']): Date | undefined {
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

notificationsRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const recipientId = asObjectId(req.userId);
    const before = readBefore(req.query);

    if (!before) {
      await ensureDueNotifications(req.userId);
    }

    const fetchLimit = NOTIFICATION_LIMIT + 1;

    const [docs, unreadCount] = await Promise.all([
      NotificationModel.find({
        recipientId,
        ...(before ? { createdAt: { $lt: before } } : {}),
      })
        .sort({ createdAt: -1 })
        .limit(fetchLimit)
        .lean(),
      NotificationModel.countDocuments({
        recipientId,
        readAt: null,
      }),
    ]);

    const hasMore = docs.length > NOTIFICATION_LIMIT;
    const page = docs.slice(0, NOTIFICATION_LIMIT);

    const actorIds = [...new Set(
      page
        .map((item) => item.actorId?.toString())
        .filter((id): id is string => Boolean(id)),
    )];
    const projectIds = [...new Set(page.map((item) => item.projectId.toString()))];
    const teamIds = [...new Set(page.map((item) => item.teamId.toString()))];

    const [actors, projects, teams] = await Promise.all([
      UserModel.find({ _id: { $in: actorIds.map((id) => asObjectId(id)) } }).lean(),
      ProjectModel.find({
        _id: { $in: projectIds.map((id) => asObjectId(id)) },
      })
        .select({ name: 1 })
        .lean(),
      TeamModel.find({ _id: { $in: teamIds.map((id) => asObjectId(id)) } })
        .select({ name: 1 })
        .lean(),
    ]);

    const actorMap = new Map(
      actors.map((user) => [
        user._id.toString(),
        { name: user.displayName, avatarUrl: user.avatarUrl },
      ]),
    );
    const projectMap = new Map(
      projects.map((project) => [project._id.toString(), project.name]),
    );
    const teamMap = new Map(
      teams.map((team) => [team._id.toString(), team.name]),
    );

    const items = page.map((item) => {
      const actorId = item.actorId?.toString() ?? '';
      const actor = actorId ? actorMap.get(actorId) : undefined;

      return {
        id: item._id.toString(),
        kind: item.kind,
        readAt: item.readAt,
        actorId,
        actorName: actor?.name ?? '',
        actorAvatarUrl: actor?.avatarUrl ?? '',
        cardId: item.cardId.toString(),
        cardTitle: item.cardTitle,
        projectId: item.projectId.toString(),
        projectName: projectMap.get(item.projectId.toString()) ?? '',
        teamId: item.teamId.toString(),
        teamName: teamMap.get(item.teamId.toString()) ?? '',
        detail: item.detail,
        createdAt: item.createdAt,
      };
    });

    res.json({ items, hasMore, unreadCount });
  }),
);

notificationsRouter.post(
  '/read-all',
  asyncHandler(async (req: Request, res: Response) => {
    await NotificationModel.updateMany(
      { recipientId: asObjectId(req.userId), readAt: null },
      { $set: { readAt: new Date() } },
    );

    res.json({ ok: true });
  }),
);

notificationsRouter.patch(
  '/:id/read',
  asyncHandler(async (req: Request, res: Response) => {
    const notification = await NotificationModel.findById(
      asObjectId(req.params.id as string, 'id'),
    );

    if (!notification) {
      throw new AppError(404, 'Уведомление не найдено');
    }

    if (notification.recipientId.toString() !== req.userId) {
      throw new AppError(403, 'Нет доступа');
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await notification.save();
    }

    res.json({ ok: true });
  }),
);
