# audit/ — CLAUDE.md

Append-only trail of every mutation. `AuditService.record(actor, action, ticketId, details)` writes an `AuditEntry`; `AuditService.list(ticketId?)` reads it back oldest-first (by `seq`), exposed at `GET /audit` (optionally filtered with `?ticketId=`).

`src/audit/` is protected by a Claude Code hook (`.claude/hooks/protect-audit.js`) that blocks Edit/Write to this path — do not attempt to work around it; ask the user if a change here is truly needed.

## Conventions

- Action names are `entity.verb`: `ticket.created`, `ticket.status_changed`, `ticket.commented`, `ticket.tags_updated`, `ticket.canned_response_applied`.
- The actor comes from the `X-Actor` header on the originating request; controllers default it to `"api"` when absent.
- `AuditEntry.details` is a free-form `Record<string, unknown>` (stored as `simple-json`) — each call site decides what's worth recording for that action.
- `GET /audit` is unpaginated, same as `GET /tickets/:id/audit` — activity volume in this v0 doesn't warrant pagination yet.
