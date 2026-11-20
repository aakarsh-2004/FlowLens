import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value;
}

const jwtSecret = required("JWT_SECRET");
if (Buffer.byteLength(jwtSecret) < 32) {
  throw new Error("JWT_SECRET must contain at least 32 bytes");
}

const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

export const config = Object.freeze({
  port,
  databaseUrl: required("DATABASE_URL"),
  jwtSecret,
  jwtExpiresIn: 900,
  jwtIssuer: "flowlens-api",
  jwtAudience: "flowlens-client",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
});
