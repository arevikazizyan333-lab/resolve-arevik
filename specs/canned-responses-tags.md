# CRT-1 — Canned responses + ticket tags

## Context

Agents currently retype the same replies over and over, and tickets have
no way to be labeled for triage/search beyond status and priority. This
adds a small, reusable library of canned responses that can be dropped
onto a ticket as a comment, and free-form tags on tickets that can be
filtered on via `GET /tickets`.

## Acceptance criteria

<!-- Numbered, atomic, observable at an API boundary. Each one must be
     assertable. Write them so a test name can quote them verbatim. -->

### Canned responses

- **AC-1** — `POST /canned-responses` with `{ title, body }` (both
  non-empty after trimming) creates a canned response and returns 201
  with the created record, including its id. Leading/trailing whitespace
  in `title` and `body` is trimmed before storage, same as ticket
  `subject`/`description`.
- **AC-2** — `POST /canned-responses` with a missing, blank, or
  whitespace-only `title` returns 400 naming `title` as the offending
  field; same for `body`.
- **AC-3** — `GET /canned-responses` returns all canned responses
  created so far, ordered oldest-first by creation time (stable,
  deterministic order — same as `GET /tickets`'s default ordering).

### Applying a canned response to a ticket

- **AC-4** — `POST /tickets/:id/canned-responses/:cannedResponseId/apply`
  on an existing ticket and an existing canned response creates a new
  ticket comment whose `body` equals the canned response's `body`
  verbatim, and returns 201 with the created comment. The request body
  may only contain `internal` (AC-5) — no other field (e.g. a body
  override) is honored, even if present.
- **AC-5** — the comment created by AC-4 defaults `internal` to `false`
  (customer-visible) unless the request body explicitly passes
  `{ internal: true }`.
- **AC-6** — the comment created by AC-4 has `author` set to the
  request's `X-Actor` header value (the same value used as the audit
  actor) — there is no separate author field for canned-response
  comments.
- **AC-7** — applying a canned response to an unknown ticket id returns
  404 (checked first, before the canned response id — consistent with
  `GET /tickets/:id/audit`'s existing ticket-first 404 order); applying
  a known ticket with an unknown `cannedResponseId` returns 404.
- **AC-8** — applying a canned response writes exactly one audit entry
  against the ticket, recording which canned response was applied and
  the resulting comment id.

### Ticket tags

- **AC-9** — a ticket's `tags` field defaults to `[]` at creation
  (`POST /tickets`); tags are only ever set afterward, via AC-10.
- **AC-10** — `PUT /tickets/:id/tags` with `{ tags: string[] }` replaces
  the ticket's tag set. Each entry is trimmed, then lowercased, then
  deduplicated, e.g. `[" VIP ", "vip", "Billing"]` is stored as
  `["vip", "billing"]`. Any non-blank string is accepted — there is no
  restriction on characters (spaces/punctuation/etc. are fine) beyond
  AC-13's blank check.
- **AC-11** — `PUT /tickets/:id/tags` with `{ tags: [] }` clears the
  ticket's tag set (valid, 200 — not an error).
- **AC-12** — `PUT /tickets/:id/tags` with `tags` missing, `null`, or
  not an array (e.g. a string or number) returns 400 naming `tags`; an
  array containing a non-string element returns the same 400.
- **AC-13** — `PUT /tickets/:id/tags` with a blank or whitespace-only
  entry in `tags` returns 400 naming `tags`.
- **AC-14** — `PUT /tickets/:id/tags` with more than 10 unique tags
  (after trimming/lowercasing/deduplication) returns 400 naming `tags`
  and the max of 10.
- **AC-15** — `PUT /tickets/:id/tags` on an unknown ticket id returns
  404.
- **AC-16** — `PUT /tickets/:id/tags` writes exactly one audit entry
  recording the ticket's previous and new tag sets.
- **AC-17** — `PUT /tickets/:id/tags` returns 200 with the full updated
  ticket (same shape as the object returned by `POST /tickets/:id/status`
  and `GET /tickets/:id`).
- **AC-18** — a ticket's `tags` field is included in every ticket
  representation returned by the API: `POST /tickets`,
  `GET /tickets/:id`, `GET /tickets` (list items), `POST
  /tickets/:id/status`, and `PUT /tickets/:id/tags`.

### Filtering by tag

- **AC-19** — `GET /tickets?tag=vip` returns only tickets whose tag set
  contains the exact tag `vip` (exact match, not a substring/prefix
  match).
- **AC-20** — `GET /tickets?tag=VIP` (mixed case) matches the same
  tickets as `GET /tickets?tag=vip` — the query value is lowercased
  before matching, since stored tags are always lowercase.
- **AC-21** — `GET /tickets?tag=%20vip%20` (leading/trailing whitespace)
  matches the same tickets as `GET /tickets?tag=vip` — the query value
  is trimmed before matching, same as stored tags.
- **AC-22** — `GET /tickets?tag=` supplied as an empty string is treated
  as no tag filter (same as omitting the parameter entirely), not an
  error.
- **AC-23** — `GET /tickets?tag=` is combinable with `status`,
  `priority`, `customerEmail`, `limit`, and `offset` — all supplied
  filters apply together (AND), consistent with existing filter
  combination behavior.
- **AC-24** — `GET /tickets?tag=doesnotexist` returns an empty result
  set (200, not an error).
- **AC-25** — when `tag` is combined with `limit`/`offset`, the returned
  pagination `meta.total` reflects the count *after* the tag filter (and
  any other supplied filters) is applied — never the unfiltered total.

## Invariants

<!-- Not scenarios: properties that hold in EVERY state, after every
     operation. These become property tests or repeated assertions. -->

- A ticket's `tags` array never has more than 10 entries.
- A ticket's `tags` array never contains duplicates, blank entries, or
  non-lowercase/non-trimmed entries.
- A ticket's `tags` is `[]` from creation until the first successful
  `PUT /tickets/:id/tags`.
- Every canned-response application and every tag update writes exactly
  one audit entry.
- Applying a canned response never mutates the canned response itself.
- Applying a canned response is not idempotent — applying the same
  canned response to the same ticket twice creates two independent
  comments.
- `GET /tickets` pagination `meta.total` always reflects the count after
  all supplied filters (including `tag`), never the pre-filter total.

## Constraints

- Follow the conventions in CLAUDE.md: repository-only DB access, actor
  from the `X-Actor` header, `BadRequestException` naming the offending
  field, ids via `newId()`, one audit entry per mutation with an
  `entity.verb` action name.
- Preserve the dual-database trick: entity columns must stay
  dialect-neutral (no Postgres-specific array/JSON types), since tests
  run against in-memory SQLite.
- No new dependencies.

## Non-goals

- Editing or deleting canned responses — only create + list + apply are
  in scope; edit/delete can follow later if needed.
- Canned response categories, folders, or search/filtering on
  `GET /canned-responses` — plain list only.
- Variable substitution / templating inside a canned response body
  (e.g. `{{customerName}}`) — applied verbatim.
- Adding or removing a single tag incrementally (e.g. `POST
  /tickets/:id/tags/:tag`) — this version only supports replacing the
  whole tag set via `PUT`.
- Setting tags at ticket creation time (`POST /tickets`) — tags always
  start as `[]` and are only set via the dedicated endpoint (AC-9/AC-10).
- Combining multiple `?tag=` values in one request (AND/OR across tags)
  — single-tag filtering only.
- A global tag registry, tag renaming, or tag usage counts — tags are
  free-form per-ticket labels, not a managed vocabulary.
- Restricting tag characters/format (e.g. slug-only, no spaces or
  punctuation) — any non-blank string is accepted after trimming
  (AC-10); this repo doesn't police string formats outside email.
- Authorization/permissions on who may create canned responses or edit
  tags — matches the rest of this codebase's no-auth v0 scope.
- Restricting which ticket statuses a canned response can be applied to
  — allowed regardless of status, same as `POST /tickets/:id/comments`
  today.

## Open questions

- Exact id prefix for canned responses (e.g. `cr_`) — implementer's
  call; follow the existing `tkt_`/`cmt_` convention.
- Audit action name for AC-8 (applying a canned response) — e.g.
  `ticket.canned_response_applied` vs. reusing `ticket.commented` with
  extra `details` — implementer's call, follow the `entity.verb`
  pattern.
- Audit action name for AC-16 (tags updated) — e.g. `ticket.tags_updated`
  — implementer's call, follow the `entity.verb` pattern.
- Whether canned response titles must be unique — deliberately
  unspecified for this version; duplicates are allowed unless a human
  decides otherwise.
- Storage representation for `tags` under the dialect-neutral constraint
  (e.g. delimited `varchar` vs. a join table) — implementer's call, as
  long as the dual-database trick still holds.
- Whether `GET /canned-responses` needs pagination — blocked on how many
  canned responses teams are expected to accumulate; out of scope for
  this version, assume an unpaginated list is fine for now.

## Definition of done

- Every AC covered by at least one test whose name cites the AC id
- Invariants covered by tests
- Full suite green
- README's endpoint list updated with the new `canned-responses` and
  ticket-tags routes
