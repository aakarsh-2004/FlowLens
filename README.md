# FlowLens

**Project intelligence, without switching between five tools.**

FlowLens is a project intelligence platform that brings together engineering and collaboration data from **Jira, GitHub, Google Calendar, and Google Meet**. It gives project managers a clear view of project progress, delivery risks, team workload, code-review bottlenecks, and relevant project activity.

> **Status:** Early development. This README describes the planned product, architecture, and repository conventions—not a list of features that are already implemented.

## Why FlowLens?

Project information is scattered: work items live in Jira, code changes in GitHub, and schedules or meeting outcomes in Google Workspace. Managers often have to visit each platform just to understand whether a project is on track.

FlowLens aims to answer questions such as:

- Are we likely to meet the next milestone? What is blocking us?
- Which features and Jira issues are progressing, stalled, or overdue?
- Which pull requests are waiting for review?
- What is each team member currently working on across tickets and code changes?
- Is work concentrated on too few people, or are project commitments exceeding declared capacity?
- What changed in this project since the last update?

FlowLens is a **decision-support system**, not an employee-ranking tool. Commit count, meeting attendance, or raw activity volume will **not** be treated as a productivity score.

## Planned Features

| Area | What it provides |
| --- | --- |
| **Portfolio overview** | All projects, deadlines, health signals, and items needing attention |
| **Project dashboard** | Scope progress, milestones, sprints, blockers, and development activity |
| **Features & issues** | Feature hierarchy with linked Jira epics, issues, and status history |
| **Team member profile** | Project assignments, tickets, PRs, commits, review queue, and activity timeline |
| **Engineering workflow** | Open/stale PRs, review waiting time, merge time, and related commits |
| **Delivery analytics** | Throughput, cycle time, lead time, overdue work, WIP, and scope changes |
| **Workload indicators** | Concurrent assignments, blocked work, cross-project allocation, and potential concentration risks |
| **Alerts** | Explainable, configurable signals for delivery, review, integration, and blocker risks |
| **Calendar & meetings** | Authorized project schedules, availability, meeting notes, decisions, and action items *(later phase)* |
| **AI assistant** | Natural-language explanations grounded in stored metrics and source evidence *(later phase)* |

Metrics are contextual: **story-point or issue-count progress must be explicitly defined**, and missing or stale data must be surfaced rather than silently interpreted as zero activity.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React + TypeScript |
| Backend | Node.js + Express.js + TypeScript |
| ORM | Prisma |
| Primary database | PostgreSQL |
| External integrations | GitHub API, Jira Cloud API, Google Calendar API, Google Meet API |
| Optional later | Redis for caching/jobs; AI agent for evidence-based analysis |

**Initial architectural choice:** One Express backend organized into clear modules for **data ingestion** and **analytics**. We may split those modules into independently deployed services later if necessary. Avoid introducing extra infrastructure before it solves a demonstrated problem.

## How FlowLens Works

```text
GitHub / Jira / Google Calendar / Google Meet
                  |
                  v
       Integration & Sync Layer
    (OAuth, webhooks, polling, retries)
                  |
                  v
      Normalize + Link Project Data
  (identities, project/feature attribution)
                  |
                  v
          PostgreSQL + Prisma
                  |
                  v
       Analytics & Risk Rules
        (metric snapshots)
                  |
                  v
        Express REST API
                  |
                  v
     React Dashboard / AI Assistant
```

1. **Connect** authorized accounts and choose relevant repositories, Jira projects, and other permitted resources.
2. **Ingest** source data using an initial sync followed by incremental updates/webhooks where supported.
3. **Normalize** users, issues, commits, PRs, and events into a consistent project-level model.
4. **Attribute** objects to projects/features using explicit mappings first, then provider relationships and structured identifiers; leave ambiguous matches for review.
5. **Analyze** the normalized records with transparent, deterministic calculations and configurable thresholds.
6. **Display** current metrics and drill-downs with source links and a visible **last synced** timestamp.

The AI assistant will **explain and investigate** metrics; it will not be the source of truth for metric calculations.

## Repository Structure (Convention)

The repository currently uses `api/` and `client/`. The structure below is the **target convention**, to be created gradually as features are implemented.

```text
FlowLens/
├── api/                              # Express + Prisma backend
│   ├── prisma/
│   │   ├── schema.prisma             # Database models and relations
│   │   ├── migrations/              # Versioned database migrations
│   │   └── seed.ts                  # Optional demo/seed data
│   ├── src/
│   │   ├── app.ts                   # Express app, middleware and routes
│   │   ├── server.ts                # HTTP server startup
│   │   ├── config/
│   │   │   └── env.ts               # Validate environment variables
│   │   ├── lib/
│   │   │   └── prisma.ts            # Shared Prisma client
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── error.middleware.ts
│   │   │   └── validate.middleware.ts
│   │   ├── modules/
│   │   │   ├── auth/                 # Authentication and authorization
│   │   │   ├── projects/             # Projects, features, memberships
│   │   │   │   ├── projects.routes.ts
│   │   │   │   ├── projects.controller.ts
│   │   │   │   ├── projects.service.ts
│   │   │   │   ├── projects.repository.ts
│   │   │   │   └── projects.schema.ts
│   │   │   ├── members/              # Profiles and member work views
│   │   │   ├── integrations/         # Provider connections + adapters
│   │   │   │   ├── github/
│   │   │   │   ├── jira/
│   │   │   │   └── google/           # Calendar / Meet (later)
│   │   │   ├── attribution/          # Cross-platform project mapping
│   │   │   ├── analytics/            # Metrics, trends, risk calculations
│   │   │   ├── activity/             # Project/member event feeds
│   │   │   └── alerts/               # Configurable alert rules
│   │   ├── jobs/                     # Scheduled/incremental sync tasks
│   │   └── utils/                    # Small shared helpers
│   ├── tests/                        # Integration/API tests
│   ├── .env.example                  # Variable names; NO secrets
│   └── package.json
├── client/                           # React + TypeScript frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── router.tsx            # App routes
│   │   │   └── providers.tsx         # App-wide providers
│   │   ├── components/
│   │   │   ├── layout/               # Sidebar, navbar, page shell
│   │   │   └── ui/                   # Reusable presentational components
│   │   ├── features/
│   │   │   ├── projects/             # Portfolio/project pages
│   │   │   ├── members/              # Team directory/profile
│   │   │   ├── integrations/         # Connection/settings screens
│   │   │   ├── analytics/            # Metric cards and charts
│   │   │   └── alerts/               # Alerts list and details
│   │   ├── hooks/                    # Shared React hooks
│   │   ├── lib/
│   │   │   └── api.ts                # Configured HTTP API client
│   │   ├── types/                    # Shared frontend TS definitions
│   │   ├── styles/                   # Global styling
│   │   └── main.tsx                  # React entry point
│   ├── .env.example
│   └── package.json
├── docs/                              # Requirements, diagrams, API docs
├── .gitignore
└── README.md
```

### Backend Module Rules

For a feature such as `projects`:

- `projects.routes.ts` — declares HTTP endpoints and applies middleware.
- `projects.controller.ts` — reads validated HTTP input and returns HTTP responses.
- `projects.service.ts` — implements business rules and coordinates operations.
- `projects.repository.ts` — makes Prisma database queries; no HTTP logic.
- `projects.schema.ts` — validates request inputs (validation library to be chosen).

**Request flow:** `Route → Controller → Service → Repository → Prisma → PostgreSQL`.

Provider adapters (`integrations/github`, `integrations/jira`, etc.) handle provider-specific APIs. Analytics code consumes normalized data, not raw provider payloads. Keep secrets and provider tokens on the backend.

### Frontend Rules

Use **feature-based folders**: each feature may contain its own `pages/`, `components/`, `hooks/`, `api/`, and `types/` as it grows. Put components in `components/ui` only when they are truly shared. Centralize API base URL and authentication handling in `lib/api.ts`.

Naming convention:

- React components/pages: `ProjectOverviewPage.tsx`, `MetricCard.tsx` (PascalCase).
- Hooks: `useProject.ts` (camelCase, `use` prefix).
- Backend module files: `projects.service.ts`, `jira.sync.ts` (lowercase dot-suffix).
- HTTP routes: plural resources, e.g. `/api/v1/projects/:projectId/members`.
- Database models: singular PascalCase in Prisma; SQL naming follows agreed Prisma mappings.

## Planned REST API

All paths below are **proposals**, not implemented endpoints. Use `/api/v1` as the common prefix.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Backend health check (outside `/api/v1`) |
| `GET` | `/api/v1/me` | Current authenticated user |
| `GET / POST` | `/api/v1/projects` | List / create projects |
| `GET / PATCH` | `/api/v1/projects/:projectId` | Read / update a project |
| `GET / POST` | `/api/v1/projects/:projectId/features` | Feature list / creation |
| `GET / POST` | `/api/v1/projects/:projectId/members` | Project membership |
| `GET` | `/api/v1/projects/:projectId/overview` | Dashboard summary |
| `GET` | `/api/v1/projects/:projectId/issues` | Linked Jira issues |
| `GET` | `/api/v1/projects/:projectId/pull-requests` | Linked GitHub PRs |
| `GET` | `/api/v1/projects/:projectId/activity` | Combined project timeline |
| `GET` | `/api/v1/projects/:projectId/metrics` | Delivery/workflow metrics |
| `GET` | `/api/v1/projects/:projectId/alerts` | Explainable active alerts |
| `GET` | `/api/v1/projects/:projectId/members/:userId/work` | Member tickets, PRs, commits |
| `GET / POST` | `/api/v1/projects/:projectId/attributions` | Inspect / correct object mappings |
| `GET / POST` | `/api/v1/integrations` | View / set up provider connections |
| `POST` | `/api/v1/integrations/:connectionId/sync` | Request a sync |
| `POST` | `/api/v1/webhooks/github` | Receive verified GitHub webhooks |
| `POST` | `/api/v1/webhooks/jira` | Receive authenticated Jira events |

Use query parameters for pagination and filtering, for example `?status=open&page=1&limit=20`. Define authorization per route before implementing it. Authentication strategy and exact provider connection endpoints will be finalized with the team.

## Development Roadmap

| Phase | Goal | Small, demonstrable result |
| --- | --- | --- |
| **1 — Foundation** | Scaffold frontend/backend, PostgreSQL + Prisma, authentication/roles, projects, features, members | Create a project and view it in a basic dashboard |
| **2 — Jira Intelligence** | Connect Jira, sync issues and changes, link issues to projects/features, compute first delivery metrics | See Jira work and overdue/blocked issues in FlowLens |
| **3 — GitHub + Team Views** | Sync repositories, PRs, commits and reviews; connect Jira keys to PRs; build member detail pages and timelines | Open a member profile and trace a ticket to its PRs |
| **4 — Collaboration + Workload** | Calendar integration, permitted Meet artifacts, meeting action items, workload indicators | See relevant schedule context and work distribution |
| **5 — Insights + Reliability** | Historical snapshots, configurable alerts, reports, optional AI explanations, optimization, tests and deployment | Demonstrate an explainable, reliable project-health dashboard |

Each phase should end with a working demo, tests for its core functionality, and updated documentation. **Do not start with the AI agent**; reliable sync, attribution, and metrics come first.

## Data, Security, and Trust Principles

- **Project attribution:** Prefer explicit project-resource mappings → provider-native links → Jira-key references → configurable prefixes → manual review. Do not silently force ambiguous links.
- **Identity:** A single person may have separate GitHub, Jira, and Google identities; map these to one authorized internal user.
- **Permissions:** Managers see only projects and data they are authorized to access. Private calendar details should not be revealed merely because someone is on a project.
- **Metric integrity:** No productivity scores based on commit counts or meeting attendance. Show the definition, time window, supporting records, and data freshness for important metrics.
- **Reliable ingestion:** Handle pagination, rate limits, retries, webhooks, duplicate events, updates, and sync failures.
- **Security:** Keep credentials out of Git, validate inputs, verify webhook signatures, scope tokens minimally, and isolate organizations' data.

## Local Development (After Setup Is Implemented)

The commands below assume that each app has its own `package.json` with a `dev` script and that PostgreSQL is available. **The team must add these scripts and `.env.example` files during Phase 1.**

```bash
# Backend
cd api
npm install
# Copy .env.example to .env and configure DATABASE_URL and other required values
npx prisma migrate dev
npx prisma generate
npm run dev
```

```bash
# Frontend (separate terminal)
cd client
npm install
# Configure the API base URL using client/.env.example
npm run dev
```

Never commit `.env` files, API keys, OAuth secrets, access tokens, or private meeting contents. Provider APIs may require additional credentials, scopes, or admin approval.

## Contributing

1. Pick a small issue from the current phase and agree on its acceptance criteria.
2. Create a focused branch, e.g. `feat/project-crud` or `fix/jira-pagination`.
3. Keep business rules in services and database access in repositories.
4. Include migrations when changing Prisma models; add tests for important behavior.
5. Open a pull request describing what changed, how to test it, and related issue IDs.
6. Update this README or `docs/` when routes, conventions, or requirements change.

---

**FlowLens: See the work, understand the risks, make better decisions.**
