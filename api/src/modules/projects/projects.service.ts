import { requireActiveUser, requireOrganizationManager } from "../../lib/access.js";
import type { Actor } from "../../lib/access.js";
import { HttpError } from "../../lib/http-error.js";
import { OrganizationsRepository } from "../organizations/organizations.repository.js";
import { ProjectsRepository } from "./projects.repository.js";
import type { FeatureInput, MilestoneInput, ProjectInput, ProjectMemberInput } from "./projects.schema.js";
import type { FeatureUpdateInput, MilestoneUpdateInput, ProjectUpdateInput } from "./projects.schema.js";

export class ProjectsService {
  constructor(private readonly repository = new ProjectsRepository()) {}

  async create(actor: Actor, organizationId: string, input: ProjectInput) {
    await requireOrganizationManager(actor, organizationId);
    if (!await new OrganizationsRepository().findById(organizationId)) throw new HttpError(404, "Organization not found");
    return this.repository.create(organizationId, input);
  }

  private async managedProject(actor: Actor, projectId: string, requireActive = true) {
    const project = await this.repository.findById(projectId);
    if (!project) throw new HttpError(404, "Project not found");
    await requireOrganizationManager(actor, project.organization_id);
    if (requireActive && !project.isActive) throw new HttpError(409, "Project is inactive");
    return project;
  }

  async update(actor: Actor, projectId: string, input: ProjectUpdateInput) {
    const project = await this.managedProject(actor, projectId, false);
    if ((input.end_date ?? project.end_date) < (input.start_date ?? project.start_date)) {
      throw new HttpError(400, "End date must be on or after start date");
    }
    return this.repository.update(projectId, input);
  }

  async updateFeature(actor: Actor, projectId: string, featureId: string, input: FeatureUpdateInput) {
    await this.managedProject(actor, projectId);
    if (!await this.repository.findFeatureForUpdate(featureId, projectId)) throw new HttpError(404, "Feature not found");
    if (input.owner_id !== undefined) {
      await requireActiveUser(input.owner_id, 404);
      if (!await this.repository.findProjectMember(projectId, input.owner_id)) {
        throw new HttpError(400, "Feature owner must be a member of this project");
      }
    }
    return this.repository.updateFeature(featureId, projectId, input);
  }

  async updateMilestone(actor: Actor, projectId: string, milestoneId: string, input: MilestoneUpdateInput) {
    await this.managedProject(actor, projectId);
    if (!await this.repository.findMilestone(milestoneId, projectId)) throw new HttpError(404, "Milestone not found");
    if (input.feature_id !== undefined && !await this.repository.findFeature(input.feature_id, projectId)) {
      throw new HttpError(400, "Feature must be active and belong to this project");
    }
    return this.repository.updateMilestone(milestoneId, projectId, input);
  }

  async addMember(actor: Actor, projectId: string, input: ProjectMemberInput) {
    const project = await this.managedProject(actor, projectId);
    await requireActiveUser(input.user_id, 404);
    if (!await this.repository.findOrganizationMember(project.organization_id, input.user_id)) {
      throw new HttpError(400, "User must belong to the project's organization");
    }
    return this.repository.addMember(projectId, input);
  }

  async createFeature(actor: Actor, projectId: string, input: FeatureInput) {
    await this.managedProject(actor, projectId);
    await requireActiveUser(input.owner_id, 404);
    if (!await this.repository.findProjectMember(projectId, input.owner_id)) {
      throw new HttpError(400, "Feature owner must be a member of this project");
    }
    return this.repository.createFeature(projectId, input);
  }

  async createMilestone(actor: Actor, projectId: string, input: MilestoneInput) {
    await this.managedProject(actor, projectId);
    if (!await this.repository.findFeature(input.feature_id, projectId)) {
      throw new HttpError(400, "Feature must be active and belong to this project");
    }
    return this.repository.createMilestone(projectId, input);
  }
}
