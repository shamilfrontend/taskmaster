import mongoose from 'mongoose';
import { TeamMemberModel } from '../models/team-member.js';
import { ProjectModel } from '../models/project.js';
import { ProjectMemberModel } from '../models/project-member.js';
import { BoardModel } from '../models/board.js';
import { CardModel } from '../models/card.js';
import { ReleaseModel } from '../models/release.js';
import { ColumnModel } from '../models/column.js';
import { AppError } from '../errors/app-error.js';
import { asObjectId } from '../utils/validate.js';
import { canManageMember } from '../utils/roles.js';
import type { TeamRole } from '../constants.js';

export interface ProjectAccess {
  teamId: string;
  teamRole: TeamRole;
  projectId: string;
  role: TeamRole;
}

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

export async function requireProjectAccess(
  projectId: string,
  userId: string,
): Promise<ProjectAccess> {
  const project = await ProjectModel.findById(asObjectId(projectId, 'projectId'))
    .lean();

  if (!project) {
    throw new AppError(404, 'Проект не найден');
  }

  const teamId = project.teamId.toString();
  const membership = await requireMembership(teamId, userId);
  const projectMember = await ProjectMemberModel.findOne({
    projectId: project._id,
    userId: asObjectId(userId, 'userId'),
  }).lean();

  if (membership.role === 'owner') {
    return {
      teamId,
      teamRole: membership.role,
      projectId: project._id.toString(),
      role: projectMember?.role ?? 'owner',
    };
  }

  if (!projectMember) {
    throw new AppError(403, 'Нет доступа к проекту');
  }

  return {
    teamId,
    teamRole: membership.role,
    projectId: project._id.toString(),
    role: projectMember.role,
  };
}

export async function listAccessibleProjectIds(
  teamId: string,
  userId: string,
  teamRole: TeamRole,
): Promise<mongoose.Types.ObjectId[]> {
  const projects = await ProjectModel.find({
    teamId: asObjectId(teamId, 'teamId'),
  })
    .select('_id')
    .lean();

  if (teamRole === 'owner') {
    return projects.map((project) => project._id);
  }

  const members = await ProjectMemberModel.find({
    userId: asObjectId(userId, 'userId'),
    projectId: { $in: projects.map((project) => project._id) },
  })
    .select('projectId')
    .lean();

  return members.map((member) => member.projectId);
}

export async function listAllAccessibleProjectIds(
  userId: string,
): Promise<mongoose.Types.ObjectId[]> {
  const userObjectId = asObjectId(userId, 'userId');
  const memberships = await TeamMemberModel.find({ userId: userObjectId })
    .lean();

  if (memberships.length === 0) {
    return [];
  }

  const ownerTeamIds = memberships
    .filter((item) => item.role === 'owner')
    .map((item) => item.teamId);
  const allTeamIds = memberships.map((item) => item.teamId);
  const projects = await ProjectModel.find({ teamId: { $in: allTeamIds } })
    .select({ _id: 1, teamId: 1 })
    .lean();

  const ownerTeamSet = new Set(
    ownerTeamIds.map((id) => id.toString()),
  );
  const ownerProjectIds = projects
    .filter((project) => ownerTeamSet.has(project.teamId.toString()))
    .map((project) => project._id);
  const remaining = projects.filter(
    (project) => !ownerTeamSet.has(project.teamId.toString()),
  );

  if (remaining.length === 0) {
    return ownerProjectIds;
  }

  const members = await ProjectMemberModel.find({
    userId: userObjectId,
    projectId: { $in: remaining.map((project) => project._id) },
  })
    .select({ projectId: 1 })
    .lean();

  return [
    ...ownerProjectIds,
    ...members.map((member) => member.projectId),
  ];
}

export function canManageProjectMember(
  access: ProjectAccess,
  targetRole: TeamRole,
): boolean {
  if (access.teamRole === 'owner') {
    return canManageMember('owner', targetRole);
  }

  return canManageMember(access.role, targetRole);
}

export function canManageProjectMembers(access: ProjectAccess): boolean {
  return access.teamRole === 'owner'
    || access.role === 'owner'
    || access.role === 'admin';
}

export async function projectIdFromBoard(boardId: string): Promise<string> {
  const board = await BoardModel.findById(asObjectId(boardId, 'boardId')).lean();

  if (!board) {
    throw new AppError(404, 'Доска не найдена');
  }

  return board.projectId.toString();
}

export async function projectIdFromColumn(columnId: string): Promise<string> {
  const column = await ColumnModel.findById(asObjectId(columnId, 'columnId'))
    .lean();

  if (!column) {
    throw new AppError(404, 'Колонка не найдена');
  }

  return projectIdFromBoard(column.boardId.toString());
}

export async function projectIdFromCard(cardId: string): Promise<string> {
  const card = await CardModel.findById(asObjectId(cardId, 'cardId')).lean();

  if (!card) {
    throw new AppError(404, 'Карточка не найдена');
  }

  return projectIdFromBoard(card.boardId.toString());
}

export async function projectIdFromRelease(releaseId: string): Promise<string> {
  const release = await ReleaseModel.findById(asObjectId(releaseId, 'releaseId'))
    .lean();

  if (!release) {
    throw new AppError(404, 'Релиз не найден');
  }

  return release.projectId.toString();
}

export async function requireProjectAccessFromBoard(
  boardId: string,
  userId: string,
): Promise<ProjectAccess> {
  return requireProjectAccess(await projectIdFromBoard(boardId), userId);
}

export async function requireProjectAccessFromColumn(
  columnId: string,
  userId: string,
): Promise<ProjectAccess> {
  return requireProjectAccess(await projectIdFromColumn(columnId), userId);
}

export async function requireProjectAccessFromCard(
  cardId: string,
  userId: string,
): Promise<ProjectAccess> {
  return requireProjectAccess(await projectIdFromCard(cardId), userId);
}

export async function requireProjectAccessFromRelease(
  releaseId: string,
  userId: string,
): Promise<ProjectAccess> {
  return requireProjectAccess(await projectIdFromRelease(releaseId), userId);
}
