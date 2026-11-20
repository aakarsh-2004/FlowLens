import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";

process.env.JWT_SECRET = randomBytes(32).toString("hex");
const { app } = await import("../src/app.js");
const { prisma } = await import("../src/lib/prisma.js");

// Uses DATABASE_URL. Creates one temporary user and deletes it in finally.
test("signup, persistence, duplicate signup, login, and profile against PostgreSQL", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const account = {
    name: "Auth integration test",
    email: `auth-test-${randomUUID()}@example.com`,
    password: randomBytes(24).toString("hex"),
  };
  const post = (path: string, body: unknown) => fetch(`${baseUrl}/api/v1/auth/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });

  try {
    const signup = await post("signup", account);
    assert.equal(signup.status, 201, JSON.stringify(await signup.clone().json()));
    const session = await signup.json();
    const stored = await prisma.users.findUniqueOrThrow({ where: { email: account.email } });
    assert.notEqual(stored.password, account.password);
    assert.match(stored.password, /^\$2b\$12\$/);
    assert.equal(session.user.password, undefined);
    assert.equal((await post("signup", account)).status, 409);
    const login = await post("login", account);
    assert.equal(login.status, 200);
    const { token } = await login.json();
    const profile = await fetch(`${baseUrl}/api/v1/me`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(profile.status, 200);
    const { user } = await profile.json();
    assert.equal(user.id, stored.id);
    assert.equal(user.password, undefined);
    assert.equal((await post("login", { ...account, password: "wrong-password" })).status, 401);
  } finally {
    try {
      await prisma.users.deleteMany({ where: { email: account.email } });
    } finally {
      await prisma.$disconnect();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }
});
