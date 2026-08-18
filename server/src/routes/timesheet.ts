import { Router } from 'express';
import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireProjectAccess } from '../middleware/access.js';
import { BoardModel } from '../models/board.js';
import { CardModel } from '../models/card.js';
import { ColumnModel } from '../models/column.js';
import { ProjectModel } from '../models/project.js';
import { ProjectMemberModel } from '../models/project-member.js';
import { TimeEntryModel } from '../models/time-entry.js';
import { UserModel } from '../models/user.js';
import { queryDateRange } from '../utils/dates.js';
import { asObjectId, isFeatureOn } from '../utils/validate.js';
import type { TeamRole } from '../constants.js';

export const timesheetRouter = Router();
timesheetRouter.use(requireAuth);

function canLogOnCard(
  role: TeamRole,
  assigneeId: string | null,
  userId: string,
): boolean {
  if (role === 'owner' || role === 'admin') {
    return true;
  }

  return role === 'member' && assigneeId === userId;
}

timesheetRouter.get(
  '/:projectId/time-entries',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const access = await requireProjectAccess(projectId, req.userId);
    const range = queryDateRange(req.query.from, req.query.to);

    if (!range) {
      throw new AppError(400, 'Нужны обе даты from и to');
    }

    const { from, to } = range;
    const project = await ProjectModel.findById(asObjectId(projectId)).lean();

    if (!project) {
      throw new AppError(404, 'Проект не найден');
    }

    const boards = await BoardModel.find({ projectId: project._id }).lean();
    const boardIds = boards.map((board) => board._id);
    const columns = await ColumnModel.find({
      boardId: { $in: boardIds },
    }).lean();
    const columnById = new Map(
      columns.map((column) => [column._id.toString(), column.name]),
    );
    const cards = await CardModel.find({ boardId: { $in: boardIds } }).lean();
    const cardById = new Map(
      cards.map((card) => [card._id.toString(), card]),
    );
    const cardIds = cards.map((card) => card._id);

    const members = await ProjectMemberModel.find({
      projectId: project._id,
    }).lean();
    const users = await UserModel.find({
      _id: { $in: members.map((item) => item.userId) },
    }).lean();
    const userById = (id: string) => (
      users.find((user) => user._id.toString() === id)
    );

    const canViewAll = access.role === 'owner'
      || access.role === 'admin'
      || access.teamRole === 'owner';
    const userIdRaw = typeof req.query.userId === 'string'
      ? req.query.userId
      : undefined;
    let filterUserId = req.userId;

    if (canViewAll && userIdRaw) {
      filterUserId = asObjectId(userIdRaw, 'userId').toString();
    }

    const entries = await TimeEntryModel.find({
      cardId: { $in: cardIds },
      workedAt: { $gte: from, $lte: to },
      ...(canViewAll && !userIdRaw ? {} : { userId: asObjectId(filterUserId) }),
    })
      .sort({ workedAt: 1 })
      .lean();

    const budgetEnabled = isFeatureOn(project.budgetEnabled);
    const hideMoney = access.role === 'viewer';
    const memberMoney = access.role === 'member';

    const visibleMoney = (value: number): number | undefined => {
      if (hideMoney || memberMoney) {
        return undefined;
      }

      return value;
    };

    const showEntryMoney = (
      entryUserId: string,
    ): boolean => {
      if (!budgetEnabled || hideMoney) {
        return false;
      }

      if (access.role === 'owner' || access.role === 'admin') {
        return true;
      }

      return access.role === 'member' && entryUserId === req.userId;
    };

    const mappedEntries = entries.map((entry) => {
      const card = cardById.get(entry.cardId.toString());
      const entryUserId = entry.userId.toString();
      const showMoney = showEntryMoney(entryUserId);

      return {
        id: entry._id.toString(),
        cardId: entry.cardId.toString(),
        cardTitle: card?.title ?? '',
        columnName: card
          ? columnById.get(card.columnId.toString()) ?? ''
          : '',
        userId: entryUserId,
        displayName: userById(entryUserId)?.displayName ?? '',
        hours: entry.hours,
        rateSnapshot: showMoney ? entry.rateSnapshot : undefined,
        amount: showMoney ? entry.amount : undefined,
        workedAt: entry.workedAt,
      };
    });

    const visibleMembers = canViewAll
      ? members.map((member) => ({
        id: member.userId.toString(),
        displayName: userById(member.userId.toString())?.displayName ?? '',
      }))
      : [{
        id: req.userId,
        displayName: userById(req.userId)?.displayName ?? '',
      }];

    const loggableCards = cards
      .filter((card) => canLogOnCard(
        access.role,
        card.assigneeId?.toString() ?? null,
        req.userId,
      ))
      .map((card) => ({
        id: card._id.toString(),
        title: card.title,
        columnName: columnById.get(card.columnId.toString()) ?? '',
        assigneeId: card.assigneeId?.toString() ?? null,
      }))
      .sort((left, right) => left.title.localeCompare(right.title, 'ru'));

    const totalHours = mappedEntries.reduce(
      (sum, entry) => sum + entry.hours,
      0,
    );
    const totalAmount = mappedEntries.reduce(
      (sum, entry) => sum + (entry.amount ?? 0),
      0,
    );

    res.json({
      from,
      to,
      role: access.role,
      budgetEnabled,
      members: visibleMembers,
      entries: mappedEntries,
      loggableCards,
      totals: {
        hours: totalHours,
        amount: visibleMoney(totalAmount),
      },
    });
  }),
);
