import mongoose from 'mongoose';
import { ActivityEventModel } from '../models/activity-event.js';
import { BoardModel } from '../models/board.js';
import { CardModel } from '../models/card.js';
import { ColumnModel } from '../models/column.js';
import { CommentModel } from '../models/comment.js';
import { InviteModel } from '../models/invite.js';
import { LabelModel } from '../models/label.js';
import { ProjectModel } from '../models/project.js';
import { ProjectMemberModel } from '../models/project-member.js';
import { ProjectMemberRateModel } from '../models/project-member-rate.js';
import { ReleaseModel } from '../models/release.js';
import { TeamModel } from '../models/team.js';
import { TeamMemberModel } from '../models/team-member.js';
import { TimeEntryModel } from '../models/time-entry.js';

export async function deleteBoardCascade(
  boardId: mongoose.Types.ObjectId,
): Promise<void> {
  const cards = await CardModel.find({ boardId }).lean();
  const cardIds = cards.map((card) => card._id);

  await TimeEntryModel.deleteMany({ cardId: { $in: cardIds } });
  await CommentModel.deleteMany({ cardId: { $in: cardIds } });
  await ActivityEventModel.deleteMany({ boardId });
  await CardModel.deleteMany({ boardId });
  await ColumnModel.deleteMany({ boardId });
  await LabelModel.deleteMany({ boardId });
  await BoardModel.deleteOne({ _id: boardId });
}

export async function deleteProjectCascade(
  projectId: mongoose.Types.ObjectId,
): Promise<void> {
  const boards = await BoardModel.find({ projectId }).lean();

  await Promise.all(
    boards.map((board) => deleteBoardCascade(board._id)),
  );

  await ReleaseModel.deleteMany({ projectId });
  await ProjectMemberRateModel.deleteMany({ projectId });
  await ProjectMemberModel.deleteMany({ projectId });
  await ProjectModel.deleteOne({ _id: projectId });
}

export async function deleteTeamCascade(
  teamId: mongoose.Types.ObjectId,
): Promise<void> {
  const projects = await ProjectModel.find({ teamId }).lean();

  await Promise.all(
    projects.map((project) => deleteProjectCascade(project._id)),
  );

  await ActivityEventModel.deleteMany({ teamId });
  await InviteModel.deleteMany({ teamId });
  await TeamMemberModel.deleteMany({ teamId });
  await TeamModel.deleteOne({ _id: teamId });
}

export async function unassignUserInTeam(
  teamId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
): Promise<void> {
  const projects = await ProjectModel.find({ teamId }).lean();
  const projectIds = projects.map((project) => project._id);
  const boards = await BoardModel.find({
    projectId: { $in: projectIds },
  }).lean();
  const boardIds = boards.map((board) => board._id);

  await CardModel.updateMany(
    { boardId: { $in: boardIds }, assigneeId: userId },
    { $set: { assigneeId: null, planAmount: 0 } },
  );

  await ProjectMemberRateModel.deleteMany({
    projectId: { $in: projectIds },
    userId,
  });
  await ProjectMemberModel.deleteMany({
    projectId: { $in: projectIds },
    userId,
  });
}

export async function unassignUserInProject(
  projectId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
): Promise<void> {
  const boards = await BoardModel.find({ projectId }).lean();
  const boardIds = boards.map((board) => board._id);

  await CardModel.updateMany(
    { boardId: { $in: boardIds }, assigneeId: userId },
    { $set: { assigneeId: null, planAmount: 0 } },
  );

  await ProjectMemberRateModel.deleteMany({ projectId, userId });
}
