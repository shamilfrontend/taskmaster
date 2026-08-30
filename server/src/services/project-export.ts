import mongoose from 'mongoose';
import { AppError } from '../errors/app-error.js';
import { DEFAULT_BOARD_BACKGROUND } from '../constants.js';
import { CardModel } from '../models/card.js';
import { ColumnModel } from '../models/column.js';
import { CommentModel } from '../models/comment.js';
import { LabelModel } from '../models/label.js';
import { ProjectModel } from '../models/project.js';
import { ReleaseModel } from '../models/release.js';
import { TimeEntryModel } from '../models/time-entry.js';
import { UserModel } from '../models/user.js';
import { resolveProjectBoard } from './project-setup.js';
import {
  PROJECT_SNAPSHOT_FORMAT,
  PROJECT_SNAPSHOT_VERSION,
  type ProjectSnapshot,
  type SnapshotPerson,
} from './project-snapshot.js';

interface WithCreatedAt {
  createdAt?: Date;
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export async function exportProject(
  projectId: mongoose.Types.ObjectId,
): Promise<ProjectSnapshot> {
  const project = await ProjectModel.findById(projectId).lean();

  if (!project) {
    throw new AppError(404, 'Проект не найден');
  }

  const board = await resolveProjectBoard(project._id);
  const [columns, labels, cards, releases] = await Promise.all([
    ColumnModel.find({ boardId: board._id }).sort({ position: 1 }).lean(),
    LabelModel.find({ boardId: board._id }).lean(),
    CardModel.find({ boardId: board._id }).sort({ position: 1 }).lean(),
    ReleaseModel.find({ projectId: project._id }).lean(),
  ]);

  const cardIds = cards.map((card) => card._id);
  const [comments, timeEntries] = cardIds.length > 0
    ? await Promise.all([
      CommentModel.find({ cardId: { $in: cardIds } }).sort({ createdAt: 1 }).lean(),
      TimeEntryModel.find({ cardId: { $in: cardIds } }).sort({ workedAt: 1 }).lean(),
    ])
    : [[], []];

  const peopleIds = new Set<string>();

  for (const card of cards) {
    if (card.assigneeId) {
      peopleIds.add(card.assigneeId.toString());
    }
  }

  for (const comment of comments) {
    peopleIds.add(comment.userId.toString());
  }

  for (const entry of timeEntries) {
    peopleIds.add(entry.userId.toString());
  }

  const users = peopleIds.size > 0
    ? await UserModel.find({
      _id: { $in: [...peopleIds].map((id) => new mongoose.Types.ObjectId(id)) },
    }).lean()
    : [];
  const userMap = new Map(users.map((user) => [user._id.toString(), user]));
  const people: SnapshotPerson[] = [...peopleIds].map((id) => {
    const user = userMap.get(id);

    return {
      id,
      email: user?.email ?? '',
      displayName: user?.displayName ?? '',
    };
  });

  return {
    format: PROJECT_SNAPSHOT_FORMAT,
    version: PROJECT_SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    project: {
      name: project.name,
      releasesEnabled: project.releasesEnabled === true,
      analyticsEnabled: project.analyticsEnabled === true,
      boardBackground: project.boardBackground ?? DEFAULT_BOARD_BACKGROUND,
    },
    people,
    columns: columns.map((column) => ({
      id: column._id.toString(),
      name: column.name,
      position: column.position,
      isDone: column.isDone === true,
    })),
    labels: labels.map((label) => ({
      id: label._id.toString(),
      name: label.name,
      color: label.color,
    })),
    releases: releases.map((release) => ({
      id: release._id.toString(),
      name: release.name,
      date: iso(release.date),
      status: release.status,
    })),
    cards: cards.map((card) => ({
      id: card._id.toString(),
      columnId: card.columnId.toString(),
      title: card.title,
      description: card.description ?? '',
      assigneeId: card.assigneeId?.toString() ?? null,
      dueDate: iso(card.dueDate),
      estimateHours: card.estimateHours ?? 0,
      releaseId: card.releaseId?.toString() ?? null,
      labelIds: (card.labelIds ?? []).map((id) => id.toString()),
      checklists: (card.checklists ?? []).map((checklist, index) => ({
        title: checklist.title,
        position: checklist.position ?? index,
        items: (checklist.items ?? []).map((item, itemIndex) => ({
          text: item.text,
          done: item.done === true,
          position: item.position ?? itemIndex,
        })),
      })),
      position: card.position,
      createdAt: iso((card as typeof card & WithCreatedAt).createdAt),
    })),
    comments: comments.map((comment) => ({
      id: comment._id.toString(),
      cardId: comment.cardId.toString(),
      parentId: comment.parentId?.toString() ?? null,
      userId: comment.userId.toString(),
      body: comment.body,
      editedAt: iso(comment.editedAt),
      createdAt: iso(comment.createdAt),
    })),
    timeEntries: timeEntries.flatMap((entry) => {
      const workedAt = iso(entry.workedAt);

      if (!workedAt) {
        return [];
      }

      return [
        {
          cardId: entry.cardId.toString(),
          userId: entry.userId.toString(),
          hours: entry.hours,
          workedAt,
        },
      ];
    }),
  };
}
