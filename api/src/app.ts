import express from "express";
import type { Express } from "express";
import cors from "cors";
import { config } from "./config/config.js";
import authRouter from "./modules/auth/auth.route.js";
import { authenticate } from "./middlewares/auth.js";
import { errorHandler } from "./middlewares/error.js";
import { me } from "./modules/auth/auth.controller.js";
import { organizationsRouter } from "./modules/organizations/organizations.routes.js";
import { projectsRouter } from "./modules/projects/projects.routes.js";

export const app: Express = express();

app.disable("x-powered-by");
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: "16kb" }));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/organizations", organizationsRouter);
app.use("/api/v1/projects", projectsRouter);

app.get("/api/v1/me", authenticate, (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
}, me);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use(errorHandler);
