import mongoose from 'mongoose';
import { BoardModel } from '../models/board.js';
import { ColumnModel } from '../models/column.js';
import { DEFAULT_BOARD_NAME, DEFAULT_COLUMNS } from '../constants.js';

export async function createDefaultBoard(
  projectId: mongoose.Types.ObjectId
): Promise<void> {
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
}
