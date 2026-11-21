import { prisma } from "./prisma.js";
import { HttpError } from "./http-error.js";

export interface Actor {
  id: string;
  isAdmin: boolean;
}

export function requireGlobalAdmin(actor: Actor) {
  if (!actor.isAdmin) throw new HttpError(403, "Global admin access required");
}

export async function requireOrganizationManager(actor: Actor, organizationId: string) {
  if (actor.isAdmin) return;
  const membership = await prisma.organization_relationships.findUnique({
    where: { organization_id_user_id: { organization_id: organizationId, user_id: actor.id } },
    select: { is_organization_admin: true },
  });
  if (!membership?.is_organization_admin) {
    throw new HttpError(403, "Organization admin access required");
  }
}

export async function requireActiveUser(userId: string, missingStatus = 401) {
  const user = await prisma.users.findUnique({
    where: { id: userId }, select: { id: true, isAdmin: true, isActive: true },
  });
  if (!user) throw new HttpError(missingStatus, "User not found");
  if (!user.isActive) throw new HttpError(403, "User account is inactive");
  return user;
}
