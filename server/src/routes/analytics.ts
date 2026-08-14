import { Router } from 'express';
import type { Request, Response } from 'express';
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
import { ReleaseModel } from '../models/release.js';
import { TeamMemberModel } from '../models/team-member.js';
import { TimeEntryModel } from '../models/time-entry.js';
import { UserModel } from '../models/user.js';
import { addDays, periodRange, startOfDay, weekStart } from '../utils/dates.js';
import { asObjectId, readPeriod } from '../utils/validate.js';

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

analyticsRouter.get(
  '/:projectId/analytics',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = req.params.projectId as string;
    const teamId = await teamIdFromProject(projectId);
    const membership = await requireMembership(teamId, req.userId);
    const period = readPeriod(req.query.period ?? '30d');
    const { from, to } = periodRange(period);

    const project = await ProjectModel.findById(asObjectId(projectId)).lean();

    if (!project) {
      throw new AppError(404, 'Проект не найден');
    }

    const boards = await BoardModel.find({ projectId: project._id }).lean();
    const boardIds = boards.map((board) => board._id);
    const columns = await ColumnModel.find({
      boardId: { $in: boardIds }
    }).lean();
    const cards = await CardModel.find({ boardId: { $in: boardIds } }).lean();
    const releases = await ReleaseModel.find({
      projectId: project._id
    }).lean();
    const allEntries = await TimeEntryModel.find({
      cardId: { $in: cards.map((card) => card._id) }
    }).lean();
    const periodEntries = allEntries.filter(
      (entry) => entry.workedAt >= from && entry.workedAt <= to
    );
    const members = await TeamMemberModel.find({
      teamId: project.teamId
    }).lean();
    const users = await UserModel.find({
      _id: { $in: members.map((item) => item.userId) }
    }).lean();

    const doneColumnIds = new Set(
      columns.filter((column) => column.isDone).map((column) => column._id.toString())
    );
    const today = startOfDay(new Date());
    const weekEnd = addDays(weekStart(today), 7);

    const isOverdue = (card: (typeof cards)[number]): boolean =>
      Boolean(
        card.dueDate &&
          startOfDay(card.dueDate) < today &&
          !doneColumnIds.has(card.columnId.toString())
      );

    const byStatus = columns.map((column) => ({
      columnId: column._id.toString(),
      name: column.name,
      count: cards.filter(
        (card) => card.columnId.toString() === column._id.toString()
      ).length
    }));

    const planHours = cards.reduce((sum, card) => sum + card.estimateHours, 0);
    const planAmount = cards.reduce((sum, card) => sum + card.planAmount, 0);
    const factHours = periodEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const factAmount = periodEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const totalFact = allEntries.reduce((sum, entry) => sum + entry.amount, 0);

    const workload = members.map((member) => {
      const userEntries = periodEntries.filter(
        (entry) => entry.userId.toString() === member.userId.toString()
      );
      const user = users.find(
        (item) => item._id.toString() === member.userId.toString()
      );
      const hours = userEntries.reduce((sum, entry) => sum + entry.hours, 0);
      const amount = userEntries.reduce((sum, entry) => sum + entry.amount, 0);
      const showMoney =
        membership.role === 'owner' ||
        membership.role === 'admin' ||
        member.userId.toString() === req.userId;

      return {
        userId: member.userId.toString(),
        displayName: user?.displayName ?? '',
        hours,
        amount: membership.role === 'viewer' ? undefined : showMoney ? amount : undefined
      };
    });

    const releaseRows = [
      ...releases.map((release) => {
        const relCards = cards.filter(
          (card) => card.releaseId?.toString() === release._id.toString()
        );
        const done = relCards.filter((card) =>
          doneColumnIds.has(card.columnId.toString())
        ).length;
        const relPlan = relCards.reduce((sum, card) => sum + card.estimateHours, 0);
        const relFact = allEntries
          .filter((entry) =>
            relCards.some((card) => card._id.toString() === entry.cardId.toString())
          )
          .reduce((sum, entry) => sum + entry.hours, 0);

        return {
          id: release._id.toString(),
          name: release.name,
          status: release.status,
          done,
          total: relCards.length,
          planHours: relPlan,
          factHours: relFact
        };
      }),
      (() => {
        const relCards = cards.filter((card) => !card.releaseId);
        const done = relCards.filter((card) =>
          doneColumnIds.has(card.columnId.toString())
        ).length;

        return {
          id: null,
          name: 'Без релиза',
          status: null,
          done,
          total: relCards.length,
          planHours: relCards.reduce((sum, card) => sum + card.estimateHours, 0),
          factHours: allEntries
            .filter((entry) =>
              relCards.some((card) => card._id.toString() === entry.cardId.toString())
            )
            .reduce((sum, entry) => sum + entry.hours, 0)
        };
      })()
    ];

    const weeks: {
      from: Date;
      to: Date;
      amount: number;
    }[] = [];
    let cursor = weekStart(from);

    while (cursor <= to) {
      const end = addDays(cursor, 7);
      const amount = periodEntries
        .filter((entry) => entry.workedAt >= cursor && entry.workedAt < end)
        .reduce((sum, entry) => sum + entry.amount, 0);
      weeks.push({ from: new Date(cursor), to: addDays(end, -1), amount });
      cursor = end;
    }

    const hideMoney = membership.role === 'viewer';
    const memberMoney = membership.role === 'member';

    const risks = cards.flatMap((card) => {
      const items: { cardId: string; title: string; kind: string; detail: string }[] = [];

      if (isOverdue(card)) {
        items.push({
          cardId: card._id.toString(),
          title: card.title,
          kind: 'overdue',
          detail: 'просрочен'
        });
      } else if (
        card.dueDate &&
        startOfDay(card.dueDate) >= today &&
        startOfDay(card.dueDate) < weekEnd &&
        !doneColumnIds.has(card.columnId.toString())
      ) {
        items.push({
          cardId: card._id.toString(),
          title: card.title,
          kind: 'dueSoon',
          detail: 'срок на этой неделе'
        });
      }

      const holes: string[] = [];

      if (!card.assigneeId) {
        holes.push('нет исполнителя');
      }

      if (!card.estimateHours) {
        holes.push('нет оценки');
      }

      if (!card.releaseId) {
        holes.push('без релиза');
      }

      if (holes.length > 0) {
        items.push({
          cardId: card._id.toString(),
          title: card.title,
          kind: 'gaps',
          detail: holes.join(', ')
        });
      }

      return items;
    });

    res.json({
      period,
      from,
      to,
      role: membership.role,
      summary: {
        cards: cards.length,
        overdue: cards.filter(isOverdue).length,
        noAssignee: cards.filter((card) => !card.assigneeId).length,
        noEstimate: cards.filter((card) => !card.estimateHours).length,
        noRelease: cards.filter((card) => !card.releaseId).length,
        factAmount: hideMoney ? undefined : memberMoney ? undefined : factAmount
      },
      byStatus,
      planVsFact: {
        planHours,
        factHours,
        planAmount: hideMoney ? undefined : memberMoney ? undefined : planAmount,
        factAmount: hideMoney ? undefined : memberMoney ? undefined : factAmount
      },
      burn: hideMoney
        ? undefined
        : {
            limit: membership.role === 'member' ? undefined : project.budgetLimit,
            totalFact: membership.role === 'member' ? undefined : totalFact,
            remainder: project.budgetLimit - totalFact
          },
      workload,
      releases: releaseRows,
      weeks: weeks.map((week) => ({
        from: week.from,
        to: week.to,
        amount: hideMoney ? undefined : memberMoney ? undefined : week.amount
      })),
      risks
    });
  })
);
