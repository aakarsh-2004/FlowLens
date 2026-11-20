import { prisma } from "../../lib/prisma.js";
import type { SignupInput } from "./auth.schema.js";

const publicUserSelect = { id: true, name: true, email: true, created_at: true } as const;

export class AuthRepository {
  createUser(data: SignupInput) {
    return prisma.users.create({ data, select: publicUserSelect });
  }

  findByEmail(email: string) {
    return prisma.users.findUnique({
      where: { email },
      select: { ...publicUserSelect, password: true },
    });
  }

  findById(id: string) {
    return prisma.users.findUnique({ where: { id }, select: publicUserSelect });
  }
}
