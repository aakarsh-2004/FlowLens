import jwt from "jsonwebtoken";
import { config } from "../config/config.js";

export function signAccessToken(userId: string): string {
  return jwt.sign({}, config.jwtSecret, {
    algorithm: "HS256",
    subject: userId,
    expiresIn: config.jwtExpiresIn,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });
}

export function verifyAccessToken(token: string): string {
  const payload = jwt.verify(token, config.jwtSecret, {
    algorithms: ["HS256"],
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });
  if (typeof payload === "string" || typeof payload.sub !== "string" || !payload.sub ||
      typeof payload.exp !== "number") {
    throw new Error("Invalid access token");
  }
  return payload.sub;
}
