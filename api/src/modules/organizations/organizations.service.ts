import { requireActiveUser, requireGlobalAdmin } from "../../lib/access.js";
import type { Actor } from "../../lib/access.js";
import { HttpError } from "../../lib/http-error.js";
import { OrganizationsRepository } from "./organizations.repository.js";
import type { OrganizationInput, OrganizationMemberInput, OrganizationUpdateInput } from "./organizations.schema.js";

export class OrganizationsService {
  constructor(private readonly repository = new OrganizationsRepository()) {}

  create(actor: Actor, input: OrganizationInput) {
    requireGlobalAdmin(actor);
    return this.repository.create(input);
  }

  async update(actor: Actor, organizationId: string, input: OrganizationUpdateInput) {
    requireGlobalAdmin(actor);
    if (!await this.repository.findById(organizationId)) throw new HttpError(404, "Organization not found");
    return this.repository.update(organizationId, input);
  }

  async addMember(actor: Actor, organizationId: string, input: OrganizationMemberInput) {
    requireGlobalAdmin(actor);

    const organization = await this.repository.findById(organizationId);
    if (!organization) throw new HttpError(404, "Organization not found");
    
    await requireActiveUser(input.user_id, 404);
    return this.repository.addMember(organizationId, input);
  }
}
