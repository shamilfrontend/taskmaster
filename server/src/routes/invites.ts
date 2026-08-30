import { Router } from 'express';
import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { InviteModel } from '../models/invite.js';
import { ProjectModel } from '../models/project.js';
import { ProjectMemberModel } from '../models/project-member.js';
import { TeamModel } from '../models/team.js';
import { TeamMemberModel } from '../models/team-member.js';
import { hashToken } from '../utils/crypto.js';

export const invitesRouter = Router();

invitesRouter.get(
  '/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.params.token as string;
    const invite = await InviteModel.findOne({
      tokenHash: hashToken(token),
    }).lean();

    if (
      !invite
      || invite.acceptedAt
      || invite.revokedAt
      || invite.expiresAt < new Date()
    ) {
      throw new AppError(404, 'Ссылка недействительна');
    }

    const team = await TeamModel.findById(invite.teamId).lean();
    const project = invite.projectId
      ? await ProjectModel.findById(invite.projectId).lean()
      : null;

    res.json({
      teamName: team?.name ?? '',
      role: invite.role,
      expiresAt: invite.expiresAt,
      ...(invite.projectId
        ? { projectName: project?.name ?? '' }
        : {}),
    });
  }),
);

invitesRouter.post(
  '/:token/accept',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.params.token as string;
    const invite = await InviteModel.findOne({
      tokenHash: hashToken(token),
    });

    if (
      !invite
      || invite.acceptedAt
      || invite.revokedAt
      || invite.expiresAt < new Date()
    ) {
      throw new AppError(404, 'Ссылка недействительна');
    }

    const existing = await TeamMemberModel.findOne({
      teamId: invite.teamId,
      userId: req.userId,
    }).lean();

    invite.acceptedAt = new Date();
    await invite.save();

    if (!existing) {
      let teamRole = invite.role;

      if (invite.projectId) {
        teamRole = invite.role === 'viewer' ? 'viewer' : 'member';
      }

      await TeamMemberModel.create({
        teamId: invite.teamId,
        userId: req.userId,
        role: teamRole,
      });
    }

    if (invite.projectId) {
      const existingProjectMember = await ProjectMemberModel.findOne({
        projectId: invite.projectId,
        userId: req.userId,
      }).lean();

      if (!existingProjectMember) {
        await ProjectMemberModel.create({
          projectId: invite.projectId,
          userId: req.userId,
          role: invite.role,
        });
      }
    }

    res.json({
      teamId: invite.teamId.toString(),
      alreadyMember: Boolean(existing),
      ...(invite.projectId
        ? { projectId: invite.projectId.toString() }
        : {}),
    });
  }),
);
