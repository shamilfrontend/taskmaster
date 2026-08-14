import mongoose from 'mongoose';
import { ProjectMemberRateModel } from '../models/project-member-rate.js';
import { TeamMemberModel } from '../models/team-member.js';
import { ProjectModel } from '../models/project.js';
import { CardModel } from '../models/card.js';
import { AppError } from '../errors/app-error.js';
import { calcPlan, resolveRate } from '../utils/rates.js';
import type { TeamRole } from '../constants.js';

export async function rateForUser(
  projectId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
): Promise<number> {
  const project = await ProjectModel.findById(projectId).lean();

  if (!project) {
    throw new AppError(404, 'Проект не найден');
  }

  const member = await TeamMemberModel.findOne({
    teamId: project.teamId,
    userId
  }).lean();

  if (!member) {
    return 0;
  }

  const personal = await ProjectMemberRateModel.findOne({
    projectId,
    userId
  }).lean();

  return resolveRate({
    roleRates: project.roleRates,
    personalAmount: personal ? personal.amount : null,
    role: member.role
  });
}

export async function recalcCardPlan(
  cardId: mongoose.Types.ObjectId
): Promise<number> {
  const card = await CardModel.findById(cardId).lean();

  if (!card) {
    throw new AppError(404, 'Карточка не найдена');
  }

  if (!card.assigneeId) {
    await CardModel.updateOne({ _id: cardId }, { $set: { planAmount: 0 } });
    return 0;
  }

  const { BoardModel } = await import('../models/board.js');
  const board = await BoardModel.findById(card.boardId).lean();

  if (!board) {
    throw new AppError(404, 'Доска не найдена');
  }

  const rate = await rateForUser(board.projectId, card.assigneeId);
  const planAmount = calcPlan(card.estimateHours, rate);

  await CardModel.updateOne({ _id: cardId }, { $set: { planAmount } });
  return planAmount;
}

export async function recalcAssigneePlans(
  projectId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
): Promise<void> {
  const { BoardModel } = await import('../models/board.js');
  const boards = await BoardModel.find({ projectId }).lean();
  const boardIds = boards.map((board) => board._id);

  const cards = await CardModel.find({
    boardId: { $in: boardIds },
    assigneeId: userId
  }).lean();

  await Promise.all(cards.map((card) => recalcCardPlan(card._id)));
}

export async function recalcRolePlans(
  projectId: mongoose.Types.ObjectId,
  role: TeamRole
): Promise<void> {
  const project = await ProjectModel.findById(projectId).lean();

  if (!project) {
    return;
  }

  const members = await TeamMemberModel.find({
    teamId: project.teamId,
    role
  }).lean();

  await Promise.all(
    members.map((member) => recalcAssigneePlans(projectId, member.userId))
  );
}
