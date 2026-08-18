import { Router } from 'express';
import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import {
  listAllAccessibleProjectIds,
  requireMembership,
} from '../middleware/access.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { BoardModel } from '../models/board.js';
import { CardModel } from '../models/card.js';
import { ColumnModel } from '../models/column.js';
import { ProjectModel } from '../models/project.js';
import { ReleaseModel } from '../models/release.js';
import { TeamModel } from '../models/team.js';
import { startOfDay } from '../utils/dates.js';
import { asObjectId, isFeatureOn } from '../utils/validate.js';

export const meRouter = Router();
meRouter.use(requireAuth);

const TASKS_LIMIT = 200;

function readOptionalId(query: Request['query'], field: string): string {
  const raw = query[field];

  if (typeof raw !== 'string' || !raw) {
    return '';
  }

  return asObjectId(raw, field).toString();
}

function checklistCounts(card: {
  checklists?: Array<{ items?: Array<{ done: boolean }> }>;
}): { done: number; total: number } {
  const items = (card.checklists ?? []).flatMap((list) => list.items ?? []);

  return {
    done: items.filter((item) => item.done).length,
    total: items.length,
  };
}

function isOverdue(dueDate: Date | null, isDone: boolean): boolean {
  if (!dueDate || isDone) {
    return false;
  }

  return startOfDay(dueDate).getTime() < startOfDay(new Date()).getTime();
}

interface TaskFilterLists {
  teams: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string; teamId: string }>;
}

function filterLists(
  teams: Array<{ _id: { toString(): string }; name: string }>,
  projects: Array<{
    _id: { toString(): string };
    name: string;
    teamId: { toString(): string };
  }>,
): TaskFilterLists {
  return {
    teams: teams
      .map((team) => ({
        id: team._id.toString(),
        name: team.name,
      }))
      .sort((left, right) => left.name.localeCompare(right.name, 'ru')),
    projects: projects
      .map((project) => ({
        id: project._id.toString(),
        name: project.name,
        teamId: project.teamId.toString(),
      }))
      .sort((left, right) => left.name.localeCompare(right.name, 'ru')),
  };
}

meRouter.get(
  '/tasks',
  asyncHandler(async (req: Request, res: Response) => {
    const includeDone = req.query.done === '1';
    const teamIdFilter = readOptionalId(req.query, 'teamId');
    const projectIdFilter = readOptionalId(req.query, 'projectId');
    const userId = asObjectId(req.userId);

    const accessibleIds = await listAllAccessibleProjectIds(req.userId);
    const allProjects = await ProjectModel.find({
      _id: { $in: accessibleIds },
    })
      .select({ name: 1, teamId: 1, releasesEnabled: 1 })
      .lean();

    if (teamIdFilter) {
      await requireMembership(teamIdFilter, req.userId);
    }

    if (projectIdFilter) {
      const allowed = allProjects.some(
        (project) => project._id.toString() === projectIdFilter,
      );

      if (!allowed) {
        throw new AppError(403, 'Нет доступа к проекту');
      }
    }

    let scopedProjects = allProjects;

    if (teamIdFilter) {
      scopedProjects = scopedProjects.filter(
        (project) => project.teamId.toString() === teamIdFilter,
      );
    }

    if (projectIdFilter) {
      scopedProjects = scopedProjects.filter(
        (project) => project._id.toString() === projectIdFilter,
      );
    }

    const teamIds = [...new Set(
      allProjects.map((project) => project.teamId.toString()),
    )];
    const teams = teamIds.length > 0
      ? await TeamModel.find({
        _id: { $in: teamIds.map((id) => asObjectId(id)) },
      })
        .select({ name: 1 })
        .lean()
      : [];
    const teamNameById = new Map(
      teams.map((team) => [team._id.toString(), team.name]),
    );

    if (scopedProjects.length === 0) {
      res.json({
        items: [],
        ...filterLists(teams, allProjects),
      });
      return;
    }

    const boards = await BoardModel.find({
      projectId: { $in: scopedProjects.map((project) => project._id) },
    }).lean();
    const boardIds = boards.map((board) => board._id);
    const boardById = new Map(
      boards.map((board) => [board._id.toString(), board]),
    );
    const columns = boardIds.length > 0
      ? await ColumnModel.find({ boardId: { $in: boardIds } }).lean()
      : [];
    const columnById = new Map(
      columns.map((column) => [column._id.toString(), column]),
    );
    const doneColumnIds = new Set(
      columns
        .filter((column) => column.isDone)
        .map((column) => column._id.toString()),
    );

    const cardFilter: {
      assigneeId: typeof userId;
      boardId: { $in: typeof boardIds };
      columnId?: { $nin: ReturnType<typeof asObjectId>[] };
    } = {
      assigneeId: userId,
      boardId: { $in: boardIds },
    };

    if (!includeDone && doneColumnIds.size > 0) {
      cardFilter.columnId = {
        $nin: [...doneColumnIds].map((id) => asObjectId(id)),
      };
    }

    const cards = boardIds.length > 0
      ? await CardModel.find(cardFilter).lean()
      : [];

    const projectById = new Map(
      scopedProjects.map((project) => [project._id.toString(), project]),
    );
    const releaseIds = [
      ...new Set(
        cards
          .map((card) => card.releaseId?.toString())
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const releases = releaseIds.length > 0
      ? await ReleaseModel.find({
        _id: { $in: releaseIds.map((id) => asObjectId(id)) },
      })
        .select({ name: 1, projectId: 1 })
        .lean()
      : [];
    const releaseById = new Map(
      releases.map((release) => [release._id.toString(), release]),
    );

    const items = cards.map((card) => {
      const board = boardById.get(card.boardId.toString());
      const project = board
        ? projectById.get(board.projectId.toString())
        : undefined;
      const column = columnById.get(card.columnId.toString());
      const isDone = column?.isDone ?? false;
      const counts = checklistCounts(card);
      const releasesEnabled = isFeatureOn(project?.releasesEnabled);
      const release = releasesEnabled && card.releaseId
        ? releaseById.get(card.releaseId.toString())
        : undefined;

      return {
        id: card._id.toString(),
        title: card.title,
        dueDate: card.dueDate ?? null,
        estimateHours: card.estimateHours,
        teamId: project?.teamId.toString() ?? '',
        teamName: project
          ? teamNameById.get(project.teamId.toString()) ?? ''
          : '',
        projectId: project?._id.toString() ?? '',
        projectName: project?.name ?? '',
        columnId: card.columnId.toString(),
        columnName: column?.name ?? '',
        isDone,
        releaseId: release ? release._id.toString() : null,
        releaseName: release?.name ?? null,
        checklistDone: counts.done,
        checklistTotal: counts.total,
      };
    }).filter((item) => item.projectId);

    items.sort((left, right) => {
      const leftOverdue = isOverdue(left.dueDate, left.isDone);
      const rightOverdue = isOverdue(right.dueDate, right.isDone);

      if (leftOverdue !== rightOverdue) {
        return leftOverdue ? -1 : 1;
      }

      if (left.dueDate && right.dueDate) {
        const diff = left.dueDate.getTime() - right.dueDate.getTime();

        if (diff !== 0) {
          return diff;
        }
      } else if (left.dueDate) {
        return -1;
      } else if (right.dueDate) {
        return 1;
      }

      return left.title.localeCompare(right.title, 'ru');
    });

    res.json({
      items: items.slice(0, TASKS_LIMIT),
      ...filterLists(teams, allProjects),
    });
  }),
);
