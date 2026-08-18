import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { config } from './config.js';
import { blockDemoWrites } from './middleware/demo-guard.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRouter } from './routes/auth.js';
import { teamsRouter } from './routes/teams.js';
import { invitesRouter } from './routes/invites.js';
import { projectsRouter } from './routes/projects.js';
import { boardsRouter } from './routes/boards.js';
import { cardsRouter } from './routes/cards.js';
import { releasesRouter } from './routes/releases.js';
import { analyticsRouter } from './routes/analytics.js';
import { notificationsRouter } from './routes/notifications.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: config.frontendUrl,
      credentials: true,
    }),
  );
  app.use(
    '/api/teams/:teamId/projects/from-trello',
    express.json({ limit: '10mb' }),
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use(blockDemoWrites);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/teams', teamsRouter);
  app.use('/api/invites', invitesRouter);
  app.use('/api/projects', analyticsRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/boards', boardsRouter);
  app.use('/api/cards', cardsRouter);
  app.use('/api/releases', releasesRouter);
  app.use('/api/notifications', notificationsRouter);

  app.use(errorHandler);

  return app;
}
