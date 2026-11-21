import type { RequestHandler } from "express";
import { organizationMemberSchema, organizationParams, organizationSchema, organizationUpdateSchema } from "./organizations.schema.js";
import { OrganizationsService } from "./organizations.service.js";

const service = new OrganizationsService();

export const updateOrganization: RequestHandler = async (req, res) => {
  const { organizationId } = organizationParams.parse(req.params);
  res.json({ organization: await service.update(req.actor!, organizationId, organizationUpdateSchema.parse(req.body)) });
};

export const createOrganization: RequestHandler = async (req, res) => {
  res.status(201).json({ organization: await service.create(req.actor!, organizationSchema.parse(req.body)) });
};

export const addOrganizationMember: RequestHandler = async (req, res) => {
  const { organizationId } = organizationParams.parse(req.params);
  const input = organizationMemberSchema.parse(req.body);
  res.status(201).json({ membership: await service.addMember(req.actor!, organizationId, input) });
};
