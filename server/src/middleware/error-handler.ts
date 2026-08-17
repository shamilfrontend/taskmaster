import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (
    typeof err === 'object'
    && err !== null
    && 'status' in err
    && (err as { status: unknown }).status === 413
  ) {
    res.status(413).json({ error: 'Файл слишком большой' });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
}
