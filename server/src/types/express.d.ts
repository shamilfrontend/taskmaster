import type { TeamRole } from '../constants.js';

declare global {
  namespace Express {
    interface Request {
      userId: string;
      membership: {
        teamId: string;
        role: TeamRole;
      };
    }
  }
}

export {};
