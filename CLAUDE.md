`# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

NestJS + PostgreSQL (TypeORM) reference implementation of a course project ("v0 — Core Tickets"). Intentionally minimal — don't build ahead of what's asked; see README's "What comes next" for planned future scope.

## Commands

```bash
# Full stack (Postgres 16 + app)
docker compose up -d --build        # then: curl localhost:3000/stats
docker compose down -v              # reset everything (drops pgdata volume)

# Local dev
docker compose up -d db             # just the database
npm install
npm start                           # ts-node src/main.ts, listens on :3000

# Tests (no database needed - in-memory SQLite)
npm test
npm run test:watch
npx jest tickets.service            # single file
npx jest -t "walks the full happy path"  # single test by name

# Build
npm run build                       # tsc -> dist/
npm run start:prod                  # node dist/main.js

# Agent SDK demo
npx tsx scripts/repo-auditor.ts     # audits the repo via Claude Agent SDK

# Infra (see terraform/README.md)
cd terraform && terraform apply     # EC2 + Docker; outputs IP/ssh command 
```
No lint/format tooling is configured in this repo (no ESLint/Prettier).

Config is env-driven with working defaults (`.env.example` documents them); the stack runs with no `.env` at all. Never commit `.env`.

## Architecture

Three NestJS modules under `src/`, wired in `app.module.ts`:

- **tickets/** – the core. `TicketsController` (thin) -> `TicketsService` (validation, status machine, orchestration) -> `TicketsRepository` (all TypeORM access). Entities: `Ticket` (string PK like `tkt_alb2c3d4`) and `TicketComment` (eager-loaded, cascade-saved via the ticket; autoincrement `seq` gives stable comment ordering).
- **audit/** – `AuditService.record(actor, action, ticketId, details)` writes an `AuditEntry`; exposed at `GET /audit`.
- **stats/** – `GET /stats`; reads through `TicketsRepository` (imports TicketsModule), computes counts in JS, not SQL.

Status machine lives in `ALLOWED_TRANSITIONS` in `src/tickets/tickets.service.ts`:
`new` -> `open` -> `in_progress` -> (`waiting_customer` <=> `in_progress`) -> `resolved` -> `closed`. Moving to `resolved` stamps `resolvedAt` (used by /stats avg resolution time).

### The dual-database trick

Runtime uses PostgreSQL; tests boot the real Nest module graph against in-memory SQLite (`better-sqlite3`). This only works because entities stick to **dialect-neutral column types** – dates are ISO strings in `varchar` columns, no `timestamptz`, no pg-specific types. Preserve this when touching entities, or tests and runtime diverge.

## Conventions (enforced by the existing code – follow them)

- Services never touch the TypeORM DataSource directly; all data access goes through the module's repository ('TicketsRepository', 'AuditService').
- Every mutation writes an audit entry. Action names are 'entity.verb': 'ticket.created', 'ticket.status_changed', 'ticket.commented'. The actor comes from the 'X-Actor' header (controllers default it to "api").
- Validation errors are 'BadRequestException' naming the offending field; controllers stay thin and pass raw bodies to the service.
- Tests use the real service + repository over in-memory SQLite – no mocks of our own code.
- IDs are 'prefix_' + 8 hex chars via 'newId()' in 'src/common/ids.ts' ('tkt_', 'cmt_').
- Comments with 'internal: true' are agent-only notes – never expose them to customers.
- 'synchronize: true' in 'app.module.ts' is a v0 convenience; migrations replace it in a later class. Don't introduce schema changes that rely on it silently.
- `src/audit/` is protected by a Claude Code hook (`.claude/hooks/protect-audit.js`) that blocks Edit/Write to that path – do not attempt to work around it; ask the user if a change there is truly needed.
- A `/feature` slash command (`.claude/commands/feature.md`) defines the explore -> plan -> implement -> test -> summary workflow for shipping small features – use it for feature-shaped tasks.

## Deploy
