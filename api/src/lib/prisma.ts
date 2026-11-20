import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { config } from "../config/config.js";

const adapter = new PrismaPg({
  connectionString: config.databaseUrl,
  connectionTimeoutMillis: 5000,
});

export const prisma = new PrismaClient({ adapter });
