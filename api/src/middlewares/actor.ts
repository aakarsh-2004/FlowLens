import type { RequestHandler } from "express";
import { requireActiveUser } from "../lib/access.js";
import type { Actor } from "../lib/access.js";

declare global {
  namespace Express {
    interface Request {
      actor?: Actor;
    }
  }
}

// Read permissions from the database on every request, so changes take effect immediately.
export const loadActor: RequestHandler = async (req, _res, next) => {
  req.actor = await requireActiveUser(req.userId!);
  next();
};
