import dotenv from 'dotenv';

dotenv.config({ path: new URL('../../.env', import.meta.url) });
dotenv.config();

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing env ${name}`);
  }

  return value;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  mongoUri: required('MONGO_URI'),
  jwtSecret: required('JWT_SECRET'),
  yandexClientId: required('YANDEX_CLIENT_ID'),
  yandexClientSecret: required('YANDEX_CLIENT_SECRET'),
  yandexRedirectUri: required('YANDEX_REDIRECT_URI'),
  cookieSecure: process.env.COOKIE_SECURE === 'true' || nodeEnv === 'production',
  jwtTtlSeconds: 7 * 24 * 60 * 60,
  cookieName: 'token',
};
