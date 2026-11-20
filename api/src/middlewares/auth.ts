import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const match = req.headers.authorization?.match(/^Bearer ([^\s]+)$/i);
  if (!match) {
    res.status(401).json({ error: "A Bearer token is required" });
    return;
  }
  try {
    req.userId = verifyAccessToken(match[1]!);
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  next();
};
