import { Prisma } from "../../../generated/prisma/client.js";
import { config } from "../../config/config.js";
import { HttpError } from "../../lib/http-error.js";
import { signAccessToken } from "../../lib/jwt.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { AuthRepository } from "./auth.repository.js";
import type { LoginInput, SignupInput } from "./auth.schema.js";

type PublicUser = NonNullable<Awaited<ReturnType<AuthRepository["findById"]>>>;

function session(user: PublicUser) {
  return { token: signAccessToken(user.id), tokenType: "Bearer", expiresIn: config.jwtExpiresIn, user };
}

export class AuthService {
  constructor(private readonly repository = new AuthRepository()) {}

  async signup(input: SignupInput) {
    const password = await hashPassword(input.password);
    try {
      const user = await this.repository.createUser({ ...input, password });
      return session(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new HttpError(409, "An account with this email already exists");
      }
      throw error;
    }
  }

  async login(input: LoginInput) {
    const record = await this.repository.findByEmail(input.email);
    const valid = await verifyPassword(input.password, record?.password ?? null);
    if (!record || !valid) throw new HttpError(401, "Invalid email or password");
    const { password: _password, ...user } = record;
    return session(user);
  }

  async me(userId: string) {
    const user = await this.repository.findById(userId);
    if (!user) throw new HttpError(401, "User no longer exists");
    return user;
  }
}
