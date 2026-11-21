import type { RequestHandler } from "express";
import { organizationParams } from "../organizations/organizations.schema.js";
import { featureSchema, milestoneSchema, projectMemberSchema, projectParams, projectSchema } from "./projects.schema.js";
import { featureParams, featureUpdateSchema, milestoneParams, milestoneUpdateSchema, projectUpdateSchema } from "./projects.schema.js";
import { ProjectsService } from "./projects.service.js";

const service = new ProjectsService();

export const updateProject: RequestHandler = async (req, res) => {
  const { projectId } = projectParams.parse(req.params);
  res.json({ project: await service.update(req.actor!, projectId, projectUpdateSchema.parse(req.body)) });
};

export const updateFeature: RequestHandler = async (req, res) => {
  const { projectId, featureId } = featureParams.parse(req.params);
  res.json({ feature: await service.updateFeature(req.actor!, projectId, featureId, featureUpdateSchema.parse(req.body)) });
};

export const updateMilestone: RequestHandler = async (req, res) => {
  const { projectId, milestoneId } = milestoneParams.parse(req.params);
  res.json({ milestone: await service.updateMilestone(req.actor!, projectId, milestoneId, milestoneUpdateSchema.parse(req.body)) });
};

export const createProject: RequestHandler = async (req, res) => {
  const { organizationId } = organizationParams.parse(req.params);
  res.status(201).json({ project: await service.create(req.actor!, organizationId, projectSchema.parse(req.body)) });
};

export const addProjectMember: RequestHandler = async (req, res) => {
  const { projectId } = projectParams.parse(req.params);
  res.status(201).json({ membership: await service.addMember(req.actor!, projectId, projectMemberSchema.parse(req.body)) });
};

export const createFeature: RequestHandler = async (req, res) => {
  const { projectId } = projectParams.parse(req.params);
  res.status(201).json({ feature: await service.createFeature(req.actor!, projectId, featureSchema.parse(req.body)) });
};

export const createMilestone: RequestHandler = async (req, res) => {
  const { projectId } = projectParams.parse(req.params);
  res.status(201).json({ milestone: await service.createMilestone(req.actor!, projectId, milestoneSchema.parse(req.body)) });
};
