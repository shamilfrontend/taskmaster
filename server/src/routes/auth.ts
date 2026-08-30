import { Router } from 'express';
import type { CookieOptions, Request, Response } from 'express';
import { config } from '../config.js';
import { AppError } from '../errors/app-error.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { UserModel } from '../models/user.js';
import { ensureDemoData, refreshDemoNotifications } from '../services/demo-seed.js';
import { signToken } from '../utils/crypto.js';

export const authRouter = Router();

function redirectPath(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) {
    return '/';
  }

  if (raw === '/api' || raw.startsWith('/api/')) {
    return '/';
  }

  return raw;
}

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: config.jwtTtlSeconds * 1000,
  };
}

interface YandexTokenResponse {
  access_token?: unknown;
}

interface YandexProfile {
  id?: unknown;
  display_name?: unknown;
  real_name?: unknown;
  default_email?: unknown;
  default_avatar_id?: unknown;
}

authRouter.get('/yandex', (req: Request, res: Response) => {
  const next = redirectPath(req.query.next);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.yandexClientId,
    redirect_uri: config.yandexRedirectUri,
    state: next,
  });

  res.redirect(`https://oauth.yandex.ru/authorize?${params.toString()}`);
});

authRouter.get(
  '/yandex/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.query;

    if (typeof code !== 'string' || !code) {
      throw new AppError(400, 'Нет кода авторизации');
    }

    const tokenRes = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: config.yandexClientId,
        client_secret: config.yandexClientSecret,
      }),
    });

    const tokenJson = (await tokenRes.json()) as YandexTokenResponse;

    if (typeof tokenJson.access_token !== 'string') {
      throw new AppError(401, 'Не удалось получить токен Яндекса');
    }

    const profileRes = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { Authorization: `OAuth ${tokenJson.access_token}` },
    });
    const profile = (await profileRes.json()) as YandexProfile;

    if (typeof profile.id !== 'string' && typeof profile.id !== 'number') {
      throw new AppError(401, 'Не удалось получить профиль Яндекса');
    }

    const yandexId = String(profile.id);
    const displayName = (typeof profile.display_name === 'string' && profile.display_name)
      || (typeof profile.real_name === 'string' && profile.real_name)
      || 'Пользователь';
    const email = typeof profile.default_email === 'string' ? profile.default_email : '';
    const avatarId = typeof profile.default_avatar_id === 'string'
      ? profile.default_avatar_id
      : '';
    const avatarUrl = avatarId
      ? `https://avatars.yandex.net/get-yapic/${avatarId}/islands-200`
      : '';

    const user = await UserModel.findOneAndUpdate(
      { yandexId },
      { $set: { displayName, email, avatarUrl } },
      { upsert: true, new: true },
    ).lean();

    if (!user) {
      throw new AppError(500, 'Не удалось сохранить пользователя');
    }

    res.cookie(config.cookieName, signToken(user._id.toString()), cookieOptions());

    const next = redirectPath(req.query.state);

    res.redirect(`${config.frontendUrl}${next}`);
  }),
);

authRouter.post(
  '/demo',
  asyncHandler(async (_req: Request, res: Response) => {
    const user = await UserModel.findOneAndUpdate(
      { yandexId: 'demo' },
      {
        $setOnInsert: {
          yandexId: 'demo',
          displayName: 'Демо',
          email: '',
          avatarUrl: '',
        },
      },
      { upsert: true, new: true },
    ).lean();

    if (!user) {
      throw new AppError(500, 'Не удалось создать демо-пользователя');
    }

    await ensureDemoData(user._id);
    await refreshDemoNotifications(user._id);
    res.cookie(
      config.cookieName,
      signToken(user._id.toString()),
      cookieOptions(),
    );
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await UserModel.findById(req.userId).lean();

    if (!user) {
      throw new AppError(401, 'Сессия недействительна');
    }

    res.json({
      id: user._id.toString(),
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      isDemo: user.yandexId === 'demo',
    });
  }),
);

authRouter.post('/logout', (req: Request, res: Response) => {
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
  });
  res.json({ ok: true });
});
