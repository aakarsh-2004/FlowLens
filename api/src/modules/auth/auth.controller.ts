import type { RequestHandler } from "express";
import { loginSchema, signupSchema } from "./auth.schema.js";
import { AuthService } from "./auth.service.js";

const service = new AuthService();

export const signup: RequestHandler = async (req, res) => {
  res.status(201).json(await service.signup(signupSchema.parse(req.body)));
};

export const login: RequestHandler = async (req, res) => {
  res.json(await service.login(loginSchema.parse(req.body)));
};

export const me: RequestHandler = async (req, res) => {
  res.json({ user: await service.me(req.userId!) });
};
