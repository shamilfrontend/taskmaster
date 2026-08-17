import { TeamMemberModel } from '../models/team-member.js';
import { ProjectModel } from '../models/project.js';
import { BoardModel } from '../models/board.js';
import { CardModel } from '../models/card.js';
import { ReleaseModel } from '../models/release.js';
import { ColumnModel } from '../models/column.js';
import { AppError } from '../errors/app-error.js';
import { asObjectId } from '../utils/validate.js';
import type { TeamRole } from '../constants.js';

export async function requireMembership(
  teamId: string,
  userId: string,
): Promise<{ teamId: string; role: TeamRole }> {
  const member = await TeamMemberModel.findOne({
    teamId: asObjectId(teamId, 'teamId'),
    userId: asObjectId(userId, 'userId'),
  }).lean();

  if (!member) {
    throw new AppError(403, 'Нет доступа к команде');
  }

  return { teamId: member.teamId.toString(), role: member.role };
}

export async function teamIdFromProject(projectId: string): Promise<string> {
  const project = await ProjectModel.findById(asObjectId(projectId, 'projectId'))
    .lean();

  if (!project) {
    throw new AppError(404, 'Проект не найден');
  }

  return project.teamId.toString();
}

export async function teamIdFromBoard(boardId: string): Promise<string> {
  const board = await BoardModel.findById(asObjectId(boardId, 'boardId')).lean();

  if (!board) {
    throw new AppError(404, 'Доска не найдена');
  }

  return teamIdFromProject(board.projectId.toString());
}

export async function teamIdFromColumn(columnId: string): Promise<string> {
  const column = await ColumnModel.findById(asObjectId(columnId, 'columnId'))
    .lean();

  if (!column) {
    throw new AppError(404, 'Колонка не найдена');
  }

  return teamIdFromBoard(column.boardId.toString());
}

export async function teamIdFromCard(cardId: string): Promise<string> {
  const card = await CardModel.findById(asObjectId(cardId, 'cardId')).lean();

  if (!card) {
    throw new AppError(404, 'Карточка не найдена');
  }

  return teamIdFromBoard(card.boardId.toString());
}

export async function teamIdFromRelease(releaseId: string): Promise<string> {
  const release = await ReleaseModel.findById(asObjectId(releaseId, 'releaseId'))
    .lean();

  if (!release) {
    throw new AppError(404, 'Релиз не найден');
  }

  return teamIdFromProject(release.projectId.toString());
}
