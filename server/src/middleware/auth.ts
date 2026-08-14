import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { AppError } from '../errors/app-error.js';
import { UserModel } from '../models/user.js';
import { verifyToken } from '../utils/crypto.js';
import { asyncHandler } from './async-handler.js';

export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.[config.cookieName];

  if (typeof token !== 'string' || !token) {
    throw new AppError(401, 'Нужна авторизация');
  }

  let userId: string;

  try {
    userId = verifyToken(token);
  } catch {
    throw new AppError(401, 'Сессия недействительна');
  }

  const user = await UserModel.findById(userId).lean();

  if (!user) {
    throw new AppError(401, 'Сессия недействительна');
  }

  req.userId = user._id.toString();
  next();
});
