import { prisma } from "../../lib/prisma.js";
import type { FeatureInput, MilestoneInput, ProjectInput, ProjectMemberInput } from "./projects.schema.js";
import type { FeatureUpdateInput, MilestoneUpdateInput, ProjectUpdateInput } from "./projects.schema.js";

export class ProjectsRepository {
  findFeatureForUpdate(id: string, projectId: string) {
    return prisma.features.findFirst({ where: { id, project_id: projectId }, select: { id: true } });
  }

  findMilestone(id: string, projectId: string) {
    return prisma.milestones.findFirst({ where: { id, project_id: projectId }, select: { id: true } });
  }

  update(id: string, input: ProjectUpdateInput) {
    return prisma.projects.update({ where: { id }, data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.start_date !== undefined && { start_date: input.start_date }),
      ...(input.end_date !== undefined && { end_date: input.end_date }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    } });
  }

  updateFeature(id: string, projectId: string, input: FeatureUpdateInput) {
    return prisma.features.update({ where: { id, project_id: projectId }, data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.owner_id !== undefined && { owner_id: input.owner_id }),
      ...(input.target_date !== undefined && { target_date: input.target_date }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    } });
  }

  updateMilestone(id: string, projectId: string, input: MilestoneUpdateInput) {
    return prisma.milestones.update({ where: { id, project_id: projectId }, data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.feature_id !== undefined && { feature_id: input.feature_id }),
      ...(input.planned_at !== undefined && { planned_at: input.planned_at }),
      ...(input.completed_at !== undefined && { completed_at: input.completed_at }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    } });
  }

  findById(id: string) {
    return prisma.projects.findUnique({ where: { id } });
  }

  findOrganizationMember(organizationId: string, userId: string) {
    return prisma.organization_relationships.findUnique({
      where: { organization_id_user_id: { organization_id: organizationId, user_id: userId } },
      select: { id: true },
    });
  }

  findProjectMember(projectId: string, userId: string) {
    return prisma.project_members.findUnique({
      where: { project_id_user_id: { project_id: projectId, user_id: userId } }, select: { id: true },
    });
  }

  findFeature(id: string, projectId: string) {
    return prisma.features.findFirst({ where: { id, project_id: projectId, isActive: true }, select: { id: true } });
  }

  create(organizationId: string, input: ProjectInput) {
    return prisma.projects.create({
      data: {
        organization_id: organizationId, name: input.name, start_date: input.start_date,
        end_date: input.end_date, isActive: input.isActive,
        description: input.description ?? null, status: input.status ?? null,
      },
    });
  }

  addMember(projectId: string, input: ProjectMemberInput) {
    return prisma.project_members.create({
      data: {
        project_id: projectId, user_id: input.user_id, project_role: input.project_role, role: input.role,
        ...(input.id !== undefined && { id: input.id }),
        ...(input.joined_at !== undefined && { joined_at: input.joined_at }),
        ...(input.created_at !== undefined && { created_at: input.created_at }),
      },
    });
  }

  createFeature(projectId: string, input: FeatureInput) {
    return prisma.features.create({
      data: {
        project_id: projectId, name: input.name, owner_id: input.owner_id, target_date: input.target_date,
        isActive: input.isActive, description: input.description ?? null, status: input.status ?? null,
      },
    });
  }

  createMilestone(projectId: string, input: MilestoneInput) {
    return prisma.milestones.create({
      data: {
        project_id: projectId, feature_id: input.feature_id, name: input.name, planned_at: input.planned_at,
        completed_at: input.completed_at ?? null, status: input.status ?? null, isActive: input.isActive,
      },
    });
  }
}
