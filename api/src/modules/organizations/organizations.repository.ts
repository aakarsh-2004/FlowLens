import { prisma } from "../../lib/prisma.js";
import type { OrganizationInput, OrganizationMemberInput, OrganizationUpdateInput } from "./organizations.schema.js";

export class OrganizationsRepository {
  findById(id: string) {
    return prisma.organizations.findUnique({ where: { id }, select: { id: true } });
  }

  create(data: OrganizationInput) {
    return prisma.organizations.create({ data });
  }

  update(id: string, input: OrganizationUpdateInput) {
    return prisma.organizations.update({ where: { id }, data: {
      ...(input.name !== undefined && { name: input.name }),
    } });
  }

  addMember(organizationId: string, input: OrganizationMemberInput) {
    return prisma.organization_relationships.create({
      data: {
        organization_id: organizationId, user_id: input.user_id, role: input.role,
        is_organization_admin: input.is_organization_admin,
        ...(input.id !== undefined && { id: input.id }),
        ...(input.created_at !== undefined && { created_at: input.created_at }),
      },
    });
  }
}
