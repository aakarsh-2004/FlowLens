import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../lib/http-error.js";

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(409).json({ error: "This record or membership already exists" });
      return;
    }
    if (error.code === "P2003" || error.code === "P2025") {
      res.status(400).json({ error: "A referenced record does not exist" });
      return;
    }
  }
  // Handle body parsing errors from express.json()
  if (error && typeof error === "object" && "type" in error) {
    if (error.type === "entity.parse.failed") {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
    if (error.type === "entity.too.large") {
      res.status(413).json({ error: "Request body too large" });
      return;
    }
  }
  console.error("Request failed", error);
  res.status(500).json({ error: "Internal server error" });
};
