import { ProjectModel } from '../models/project.js';
import { ProjectMemberModel } from '../models/project-member.js';
import { TeamMemberModel } from '../models/team-member.js';

export async function backfillProjectMembers(): Promise<void> {
  const projects = await ProjectModel.find().select('_id teamId').lean();

  if (projects.length === 0) {
    return;
  }

  const existing = await ProjectMemberModel.distinct('projectId');
  const existingIds = new Set(existing.map((id) => id.toString()));
  const missing = projects.filter(
    (project) => !existingIds.has(project._id.toString()),
  );

  if (missing.length === 0) {
    return;
  }

  const teamIds = [
    ...new Set(missing.map((project) => project.teamId.toString())),
  ];
  const teamMembers = await TeamMemberModel.find({
    teamId: { $in: teamIds },
  }).lean();
  const membersByTeam = new Map<string, typeof teamMembers>();

  for (const member of teamMembers) {
    const key = member.teamId.toString();
    const list = membersByTeam.get(key) ?? [];
    list.push(member);
    membersByTeam.set(key, list);
  }

  const docs = missing.flatMap((project) => {
    const members = membersByTeam.get(project.teamId.toString()) ?? [];

    return members.map((member) => ({
      projectId: project._id,
      userId: member.userId,
      role: member.role,
    }));
  });

  if (docs.length > 0) {
    await ProjectMemberModel.insertMany(docs);
  }
}
