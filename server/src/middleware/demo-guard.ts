import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { AppError } from '../errors/app-error.js';
import { UserModel } from '../models/user.js';
import { verifyToken } from '../utils/crypto.js';
import { asyncHandler } from './async-handler.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const WRITE_ALLOW = new Set(['/api/auth/logout', '/api/auth/demo']);
const NOTIFICATION_READ_PATH = /^\/api\/notifications\/[a-fA-F0-9]{24}\/read$/;

function isDemoWriteAllowed(path: string): boolean {
  if (WRITE_ALLOW.has(path) || path === '/api/notifications/read-all') {
    return true;
  }

  return NOTIFICATION_READ_PATH.test(path);
}

export const DEMO_BLOCKED_MESSAGE = 'Действия в демо-доступе отключены';

export const blockDemoWrites = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!WRITE_METHODS.has(req.method) || isDemoWriteAllowed(req.path)) {
      next();
      return;
    }

    const token = req.cookies?.[config.cookieName];

    if (typeof token !== 'string' || !token) {
      next();
      return;
    }

    let userId: string;

    try {
      userId = verifyToken(token);
    } catch {
      next();
      return;
    }

    const user = await UserModel.findById(userId).lean();

    if (user?.yandexId === 'demo') {
      throw new AppError(403, DEMO_BLOCKED_MESSAGE);
    }

    next();
  },
);
