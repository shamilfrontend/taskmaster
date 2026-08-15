import mongoose from 'mongoose';
import { BoardModel, type BoardPojo } from '../models/board.js';
import { ColumnModel } from '../models/column.js';
import { DEFAULT_BOARD_NAME, DEFAULT_COLUMNS } from '../constants.js';
import { deleteBoardCascade } from './cascade.js';

export async function createDefaultBoard(
  projectId: mongoose.Types.ObjectId
): Promise<BoardPojo> {
  const board = await BoardModel.create({
    projectId,
    name: DEFAULT_BOARD_NAME
  });

  await ColumnModel.insertMany(
    DEFAULT_COLUMNS.map((column, index) => ({
      boardId: board._id,
      name: column.name,
      position: index,
      isDone: column.isDone
    }))
  );

  return board.toObject();
}

export async function resolveProjectBoard(
  projectId: mongoose.Types.ObjectId
): Promise<BoardPojo> {
  const boards = await BoardModel.find({ projectId }).sort({ _id: 1 }).lean();

  if (boards.length === 0) {
    return createDefaultBoard(projectId);
  }

  const [primary, ...extras] = boards;

  if (!primary) {
    return createDefaultBoard(projectId);
  }

  for (const extra of extras) {
    await deleteBoardCascade(extra._id);
  }

  return primary;
}
