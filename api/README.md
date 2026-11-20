# FlowLens API

Requires Node.js 22.12+ and PostgreSQL. From `api/`:

```sh
pnpm install
# Copy .env.example to .env, configure DATABASE_URL, and generate JWT_SECRET:
pnpm exec prisma migrate dev
pnpm exec prisma generate
pnpm dev
```

Set `JWT_SECRET` to the generated value (at least 32 bytes). The server loads `.env`
automatically and fails at startup if required configuration is missing.
`PORT` defaults to `3000`; `CLIENT_ORIGIN` defaults to `http://localhost:5173`.

## Authentication

| Method | Endpoint | Body / authentication |
| --- | --- | --- |
| POST | `/api/v1/auth/signup` | `{ "name": "Ada", "email": "ada@example.com", "password": "a-long-password" }` |
| POST | `/api/v1/auth/login` | `{ "email": "ada@example.com", "password": "a-long-password" }` |
| GET | `/api/v1/me` | `Authorization: Bearer <token>` |
| GET | `/api/v1/auth/me` | Alias for the current-user endpoint |
| GET | `/health` | No authentication |

Signup returns `201`; login returns `200`. Both return:

```json
{
  "token": "<signed-jwt>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "<uuid>",
    "name": "Ada",
    "email": "ada@example.com",
    "created_at": "<ISO timestamp>"
  }
}
```

Emails are trimmed and lowercased. Names must contain 1–100 characters, emails
at most 254, and signup passwords at least 8 characters and at most 72 UTF-8
bytes. Passwords are preserved exactly and stored as bcrypt hashes with cost 12.
The hash includes its salt and cost, so future cost changes do not break login
for existing bcrypt hashes. Profile responses never contain passwords.
Login and signup inputs are validated with Zod schemas in `src/modules/auth/auth.schema.ts`;
the TypeScript input types are inferred from those schemas.
Duplicate emails return `409`; invalid input returns `400`; incorrect credentials,
missing/invalid/expired tokens, and deleted users return `401`. Errors use
`{ "error": "message" }`.

JWTs use HS256, the user ID as subject, a 15-minute expiry, and verified issuer
and audience. After expiry, log in again. Logout clears the token on the client;
issued tokens remain valid until expiry. Refresh tokens and server-side token
revocation are not implemented.

To protect another route, add `authenticate` from `src/middlewares/auth.ts`.
The verified ID is available as `req.userId`; resource routes must separately
check organization/project membership.

## Checks

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

`pnpm test` exercises HTTP auth behavior with the repository mocked. To also
verify real Prisma/PostgreSQL persistence, run `pnpm test:integration` against
the configured database after applying migrations. It creates a temporary user
and deletes that user on completion.
