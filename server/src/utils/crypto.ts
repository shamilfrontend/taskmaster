import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

interface JwtPayload {
  userId: string;
}

export function signToken(userId: string): string {
  return jwt.sign({ userId } satisfies JwtPayload, config.jwtSecret, {
    expiresIn: '7d'
  });
}

export function verifyToken(token: string): string {
  const payload = jwt.verify(token, config.jwtSecret);

  if (typeof payload === 'string' || typeof payload.userId !== 'string') {
    throw new Error('Invalid token');
  }

  return payload.userId;
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function createInviteToken(): string {
  return randomBytes(16).toString('hex');
}

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');
}
