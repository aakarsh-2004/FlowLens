import { Router } from "express";
import { authenticate } from "../../middlewares/auth.js";
import { loadActor } from "../../middlewares/actor.js";
import { addOrganizationMember, createOrganization, updateOrganization } from "./organizations.controller.js";
import { createProject } from "../projects/projects.controller.js";

export const organizationsRouter: Router = Router();
organizationsRouter.use(authenticate, loadActor);
organizationsRouter.post("/", createOrganization);
organizationsRouter.patch("/:organizationId", updateOrganization);
organizationsRouter.post("/:organizationId/members", addOrganizationMember);
organizationsRouter.post("/:organizationId/projects", createProject);
