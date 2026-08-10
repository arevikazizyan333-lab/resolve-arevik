# stats/ — CLAUDE.md

Single read-only endpoint, `GET /stats`. `StatsController` reads through `TicketsRepository` directly (the module imports `TicketsModule`) — there is no `StatsService`.

## Conventions

- Counts (`byStatus`, `byPriority`) and `avgResolutionMinutes` are computed in JS over the full ticket set fetched from the repository, not via SQL aggregation. Fine at this v0's scale; revisit if the ticket count grows enough to matter.
- `avgResolutionMinutes` is `null` when no tickets have been resolved yet, not `0` — don't conflate "no data" with "instant resolution".
- This module has no persistence of its own; it derives everything from `tickets/`'s data, so schema or status-machine changes there can change `/stats`'s output without any change in this module.
