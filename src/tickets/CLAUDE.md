# tickets/ — CLAUDE.md

The core module. `TicketsController` (thin, no class-level route prefix) -> `TicketsService` (validation, status machine, orchestration) -> `TicketsRepository` (all TypeORM access, including the in-memory canned-response store).

See the root [CLAUDE.md](../../CLAUDE.md) for cross-cutting conventions (audit entries, the dual-database trick, dialect-neutral column types).

## Entities

- `Ticket` — string PK like `tkt_a1b2c3d4`. Holds `tags: string[]` and `comments: TicketComment[]` (eager-loaded, cascade-saved via the ticket).
- `TicketComment` — autoincrement `seq` gives stable comment ordering. `internal: true` marks agent-only notes — **never expose these to customers**.
- `CannedResponse` (`src/tickets/canned-response.model.ts`) — not a TypeORM entity; held in-memory by `TicketsRepository` since v0 has no dedicated table for it.

## Status machine

Lives in `ALLOWED_TRANSITIONS` in `tickets.service.ts`:

`new` -> `open` -> `in_progress` -> (`waiting_customer` <=> `in_progress`) -> `resolved` -> (`closed` | reopen to `open`)

Moving to `resolved` stamps `resolvedAt` (used by `/stats` avg resolution time); reopening a resolved ticket back to `open` clears it.

## Conventions

- Validation errors are `BadRequestException` naming the offending field; the controller stays thin and passes raw bodies to the service.
- IDs are `prefix_` + 8 hex chars via `newId()` in `src/common/ids.ts`: `tkt_` (tickets), `cmt_` (comments), `cr_` (canned responses).
- Tags are deduped and lowercased in `setTags`, capped at `MAX_TAGS` (10); blank entries are rejected.
- `findAuditTrail` returns entries newest-first (sorted on `seq`), deliberately the reverse of `GET /audit` — a ticket's detail view reads most-recent-first. See the comment above that method for the full rationale.
- Canned-response routes (`/canned-responses`, `/tickets/:id/canned-responses/:crId/apply`) live at the top level, not nested under `/tickets`, which is why the controller has no class-level `@Controller('tickets')` prefix.
