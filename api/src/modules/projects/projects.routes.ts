import { Router } from "express";
import { authenticate } from "../../middlewares/auth.js";
import { loadActor } from "../../middlewares/actor.js";
import { addProjectMember, createFeature, createMilestone } from "./projects.controller.js";
import { updateFeature, updateMilestone, updateProject } from "./projects.controller.js";

export const projectsRouter: Router = Router();
projectsRouter.use(authenticate, loadActor);
projectsRouter.patch("/:projectId", updateProject);
projectsRouter.patch("/:projectId/features/:featureId", updateFeature);
projectsRouter.patch("/:projectId/milestones/:milestoneId", updateMilestone);
projectsRouter.post("/:projectId/members", addProjectMember);
projectsRouter.post("/:projectId/features", createFeature);
projectsRouter.post("/:projectId/milestones", createMilestone);
