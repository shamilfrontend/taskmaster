import type { Express } from 'express';
import { createApp } from './app.js';
import { config } from './config.js';
import { connectDb } from './db.js';
import { backfillProjectMembers } from './services/migrate-project-members.js';

const LISTEN_RETRY_DELAYS_MS = [50, 100, 150, 200, 300, 400, 500];

function listen(app: Express, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, resolve);
    server.once('error', reject);
  });
}

async function listenWithRetry(app: Express, port: number, attempt = 0): Promise<void> {
  try {
    await listen(app, port);
    console.log(`API listening on ${port}`);
  } catch (err) {
    const busy = (err as NodeJS.ErrnoException).code === 'EADDRINUSE';
    const delayMs = LISTEN_RETRY_DELAYS_MS[attempt];

    if (!busy || delayMs === undefined) {
      throw err;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    });
    await listenWithRetry(app, port, attempt + 1);
  }
}

async function main(): Promise<void> {
  await connectDb();
  await backfillProjectMembers();
  await listenWithRetry(createApp(), config.port);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
