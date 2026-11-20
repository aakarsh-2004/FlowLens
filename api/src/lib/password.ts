import bcrypt from "bcrypt";

const saltRounds = 12;
// Keep unknown-email logins as expensive as password verification.
const dummyHash = bcrypt.hash("unused-login-placeholder", saltRounds);

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  const valid = await bcrypt.compare(password, hash ?? await dummyHash);
  return hash !== null && valid;
}
