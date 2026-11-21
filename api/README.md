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
    "created_at": "<ISO timestamp>",
    "isAdmin": false,
    "isActive": true
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

## Organizations and project creation

All endpoints below require `Authorization: Bearer <token>` and an active user.
Permissions are loaded from the database for each request, so changing admin
flags takes effect without issuing another token.

| Action | Global admin (`users.isAdmin`) | Organization admin (`organization_relationships.is_organization_admin`) |
| --- | --- | --- |
| Create organizations | Yes | No |
| Add organization members or grant organization-admin access | Yes | No |
| Create organization projects | Yes | Within their organization |
| Add project members | Yes | Within their organization |
| Create features and milestones | Yes | Within their organization |

Ordinary members and project managers cannot perform these operations. The
membership `role` and `project_role` fields describe a person's role; they do not
grant global or organization-admin access.

Public signup always creates a non-admin account, even if `isAdmin` is supplied.
To provision the first global admin, use a trusted database connection or
`pnpm exec prisma studio` to set an existing user's `isAdmin` to `true`. There
is no public endpoint for granting global-admin access.

Every creation endpoint returns `201` with the created row in the named wrapper:

| Endpoint (POST) | Response wrapper |
| --- | --- |
| `/api/v1/organizations` | `organization` |
| `/api/v1/organizations/:organizationId/members` | `membership` |
| `/api/v1/organizations/:organizationId/projects` | `project` |
| `/api/v1/projects/:projectId/members` | `membership` |
| `/api/v1/projects/:projectId/features` | `feature` |
| `/api/v1/projects/:projectId/milestones` | `milestone` |

Create an organization:

```json
{ "name": "Acme" }
```

Add an existing user to an organization:

```json
{
  "user_id": "<user UUID>",
  "role": "Engineering lead",
  "is_organization_admin": true
}
```

This accepts every writable membership column: `user_id`, `role`,
`is_organization_admin` (defaults to `false`), optional `id`, and optional
`created_at` (UTC ISO timestamp). `organization_id` comes from the URL. Omitted
IDs and timestamps use the database defaults. Duplicate organization/user pairs
return `409`.

Create a project inside that organization:

```json
{
  "name": "Website launch",
  "description": "Launch the new website",
  "status": "planned",
  "start_date": "2026-11-20",
  "end_date": "2026-12-20",
  "isActive": true
}
```

`description` and `status` are optional/nullable; `isActive` defaults to `true`.
The end date must be on or after the start date.

Assign an organization member to a project:

```json
{
  "user_id": "<user UUID>",
  "project_role": "Backend engineer",
  "role": "MEMBER",
  "joined_at": "2026-11-20T10:00:00.000Z"
}
```

`role` must be `PROJECT_MANAGER`, `MEMBER`, or `GUEST`. Optional `id`,
`joined_at`, and `created_at` can be supplied; omitted values use defaults.
`project_id` comes from the URL. The user must be active and belong to the
project's organization. Duplicate project/user pairs return `409`.

Create a feature:

```json
{
  "name": "Authentication",
  "description": "Login and signup",
  "status": "in_progress",
  "owner_id": "<project member UUID>",
  "target_date": "2026-12-10"
}
```

The owner must be an active project member. `description` and `status` are
optional/nullable; `isActive` is optional and defaults to `true`.

Create a milestone:

```json
{
  "name": "Authentication ready",
  "feature_id": "<feature UUID>",
  "status": "planned",
  "planned_at": "2026-12-10",
  "completed_at": null
}
```

The feature must be active and belong to the project in the URL. `status` and
`completed_at` are optional/nullable; `isActive` defaults to `true`. All date-only
fields use `YYYY-MM-DD`. New project content and memberships require an active
project. Body fields cannot override the organization/project ID from the URL.

Invalid inputs or references return `400`, missing resources return `404`,
insufficient permissions or inactive users return `403`, and inactive projects
or duplicate records return `409`. Missing/deleted request identities return
`401`. All errors use `{ "error": "message" }`.

Apply the checked-in migrations to another database with
`pnpm exec prisma migrate deploy`, then run `pnpm exec prisma generate`.
The new migration also adds unique membership constraints and milestone foreign
keys that enforce the feature/project pairing. Existing data must satisfy those
constraints; migration does not delete or merge existing rows.

## Editing

PATCH routes accept partial updates and return `200` with the updated row:

| Endpoint | Permission | Editable fields |
| --- | --- | --- |
| `/api/v1/organizations/:organizationId` | Global admin | `name` |
| `/api/v1/projects/:projectId` | Global admin or this organization's admin | `name`, `description`, `status`, `start_date`, `end_date`, `isActive` |
| `/api/v1/projects/:projectId/features/:featureId` | Global admin or this organization's admin | `name`, `description`, `status`, `owner_id`, `target_date`, `isActive` |
| `/api/v1/projects/:projectId/milestones/:milestoneId` | Global admin or this organization's admin | `name`, `status`, `feature_id`, `planned_at`, `completed_at`, `isActive` |

Use the same Bearer authentication and response wrappers as creation. For example,
PATCH a project with `{ "status": "in_progress" }` or clear a milestone's
completion date with `{ "completed_at": null }`. Omitted fields stay unchanged;
empty objects, unknown fields, IDs, parent IDs, and creation timestamps are rejected.
Nullable fields can be explicitly cleared with `null`.

Project date changes are checked against the resulting start/end dates, including
the existing value when only one date is supplied. New feature owners must be active
project members; a new milestone feature must be active and in the same project.
Feature and milestone IDs must belong to the project in the URL, otherwise `404`
is returned. An inactive project can be edited/reactivated by an authorized admin;
its features and milestones can be edited after the project is reactivated.
Inactive features and milestones can themselves be edited/reactivated.

## Checks

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

`pnpm test` exercises HTTP auth behavior with the repository mocked. To also
verify real Prisma/PostgreSQL persistence and the creation permission matrix,
run `pnpm test:integration` against the configured database after applying
migrations. It creates temporary users, organizations, memberships, projects,
features, and milestones, and deletes those fixtures on completion.
