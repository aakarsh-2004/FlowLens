import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { after, before, beforeEach, mock, test } from "node:test";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import type { users } from "../generated/prisma/client.js";
import type { SignupInput } from "../src/modules/auth/auth.schema.js";

process.env.JWT_SECRET = randomBytes(32).toString("hex");
process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";

const { app } = await import("../src/app.js");
const { config } = await import("../src/config/config.js");
const { AuthRepository } = await import("../src/modules/auth/auth.repository.js");
const { Prisma } = await import("../generated/prisma/client.js");
const { verifyPassword } = await import("../src/lib/password.js");

const records = new Map<string, users>();
let server: Server;
let baseUrl: string;
const account = { name: "Test User", email: "test@example.com", password: "test-password-123" };

function publicUser(record: users) {
  const { password: _password, ...user } = record;
  return user;
}

before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(() => {
  mock.restoreAll();
  records.clear();
  mock.method(AuthRepository.prototype, "createUser", async (input: SignupInput) => {
    if (records.has(input.email)) {
      throw new Prisma.PrismaClientKnownRequestError("Duplicate email", {
        code: "P2002", clientVersion: "7.10.1",
      });
    }
    const record = { ...input, id: randomUUID(), created_at: new Date() };
    records.set(record.email, record);
    return publicUser(record);
  });
  mock.method(AuthRepository.prototype, "findByEmail", async (email: string) => records.get(email) ?? null);
  mock.method(AuthRepository.prototype, "findById", async (id: string) => {
    const record = [...records.values()].find((user) => user.id === id);
    return record ? publicUser(record) : null;
  });
});

after(async () => {
  mock.restoreAll();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

async function post(path: string, body: unknown) {
  return fetch(`${baseUrl}/api/v1/auth/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

async function signup() {
  const response = await post("signup", account);
  assert.equal(response.status, 201);
  return response.json();
}

test("signup normalizes input, stores a salted hash, and returns a safe user with an expiring JWT", async () => {
  const response = await post("signup", { ...account, name: " Test User ", email: " TEST@Example.com " });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.user.email, account.email);
  assert.equal(body.user.name, account.name);
  assert.equal(body.user.password, undefined);
  assert.equal(body.tokenType, "Bearer");
  assert.equal(body.expiresIn, 900);
  const payload = jwt.verify(body.token, config.jwtSecret, {
    algorithms: ["HS256"], issuer: config.jwtIssuer, audience: config.jwtAudience,
  });
  assert(typeof payload === "object");
  assert.equal(payload.sub, body.user.id);
  assert.equal(payload.exp! - payload.iat!, 900);
  const hash = records.get(account.email)!.password;
  assert.notEqual(hash, account.password);
  assert.equal(bcrypt.getRounds(hash), 12);
  assert(await verifyPassword(account.password, hash));
  assert.equal(await verifyPassword("wrong-password", hash), false);
  const other = await post("signup", { ...account, email: "other@example.com" });
  assert.equal(other.status, 201);
  assert.notEqual(records.get("other@example.com")!.password, hash);
});

test("duplicate signup returns 409 including normalized emails", async () => {
  await signup();
  const response = await post("signup", { ...account, email: " TEST@EXAMPLE.COM " });
  assert.equal(response.status, 409);
  assert.equal(records.size, 1);
});

test("bcrypt verifies stored hashes with a different cost", async () => {
  const hash = await bcrypt.hash(account.password, 10);
  assert(await verifyPassword(account.password, hash));
  assert.equal(await verifyPassword("incorrect", hash), false);
  assert.equal(await verifyPassword(account.password, null), false);
});

test("password validation rejects more than 72 bytes without silently truncating", async () => {
  for (const password of ["a".repeat(73), "🙂".repeat(19)]) {
    for (const path of ["signup", "login"]) {
      assert.equal((await post(path, { ...account, password })).status, 400);
    }
  }
  const password = "🙂".repeat(18);
  assert.equal((await post("signup", { ...account, password })).status, 201);
  assert.equal((await post("login", { email: account.email, password })).status, 200);
});

test("concurrent signup handles unique constraint conflicts", async () => {
  const responses = await Promise.all([post("signup", account), post("signup", account)]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
});

test("login returns a usable token and no password", async () => {
  await signup();
  const response = await post("login", { email: " TEST@EXAMPLE.COM ", password: account.password });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.user.password, undefined);
  for (const path of ["/api/v1/me", "/api/v1/auth/me"]) {
    const me = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${body.token}` } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.id, body.user.id);
    assert.equal(me.headers.get("cache-control"), "no-store");
  }
});

test("unknown email and incorrect password return the same 401 response", async () => {
  await signup();
  const wrong = await post("login", { email: account.email, password: "incorrect" });
  const missing = await post("login", { email: "missing@example.com", password: account.password });
  assert.equal(wrong.status, 401);
  assert.equal(missing.status, 401);
  assert.deepEqual(await wrong.json(), await missing.json());
});

test("signup validates fields and ignores client-supplied IDs and roles", async () => {
  for (const input of [null, [], {}, { ...account, name: " " }, { ...account, name: "a".repeat(101) },
    { ...account, email: "invalid" }, { ...account, email: 123 }, { ...account, password: "short" },
    { ...account, password: 123 }, { ...account, password: "x".repeat(129) }]) {
    const response = await post("signup", input);
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, "string");
  }
  assert.equal(records.size, 0);
  const response = await post("signup", { ...account, id: "attacker", role: "ADMIN" });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.notEqual(body.user.id, "attacker");
  assert.equal(body.user.role, undefined);
});

test("login validation returns JSON client errors for invalid inputs", async () => {
  for (const input of [null, [], {}, { email: "invalid", password: account.password },
    { email: account.email, password: "" }, { email: account.email, password: 123 }]) {
    const response = await post("login", input);
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, "string");
  }
});

test("malformed JSON and excessive request bodies return JSON client errors", async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{broken",
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid JSON body" });
  const oversized = await post("signup", { ...account, name: "x".repeat(17000) });
  assert.equal(oversized.status, 413);
});

test("missing and malformed authorization headers return 401", async () => {
  for (const header of [undefined, "Basic abc", "Bearer", "Bearer a b", "Bearer "]) {
    const response = await fetch(`${baseUrl}/api/v1/me`, {
      headers: header ? { Authorization: header } : {},
    });
    assert.equal(response.status, 401);
  }
});

test("expired, tampered, wrong-key, wrong-algorithm and invalid-claim tokens return 401", async () => {
  const { user, token } = await signup();
  const claims = { issuer: config.jwtIssuer, audience: config.jwtAudience, subject: user.id, expiresIn: 900 };
  const tokens = [
    `${token}tampered`,
    jwt.sign({}, config.jwtSecret, { ...claims, expiresIn: -1 }),
    jwt.sign({}, "different-secret", claims),
    jwt.sign({}, config.jwtSecret, { ...claims, algorithm: "HS384" }),
    jwt.sign({}, config.jwtSecret, { ...claims, issuer: "other" }),
    jwt.sign({}, config.jwtSecret, { ...claims, audience: "other" }),
    jwt.sign({}, config.jwtSecret, { issuer: claims.issuer, audience: claims.audience, expiresIn: 900 }),
    jwt.sign({}, config.jwtSecret, { issuer: claims.issuer, audience: claims.audience, subject: user.id }),
    "not-a-jwt",
  ];
  for (const invalidToken of tokens) {
    const response = await fetch(`${baseUrl}/api/v1/me`, { headers: { Authorization: `Bearer ${invalidToken}` } });
    assert.equal(response.status, 401);
  }
});

test("a token for a deleted user returns 401", async () => {
  const { token } = await signup();
  records.clear();
  const response = await fetch(`${baseUrl}/api/v1/me`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(response.status, 401);
});

test("unexpected database errors are hidden from the response", async () => {
  mock.method(AuthRepository.prototype, "findByEmail", async () => { throw new Error("private database details"); });
  const logged = mock.method(console, "error", () => {});
  const response = await post("login", account);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Internal server error" });
  assert.equal(logged.mock.callCount(), 1);
});
