# Homework 5: Measure Tier 3 — Submission

## 1. Measure Table — Tier 1 / Tier 2 / Tier 3

| Tier | What was pinned down | What still varied / was ambiguous |
|---|---|---|
| **Tier 1 (prompt only)** | Only the two feature names ("canned responses" and "ticket tags") and the four scope bullets given in the prompt. | **Everything else:** Endpoint shapes and paths, HTTP verbs, status codes, validation rules, error format, whether tags live on the ticket or a separate resource, audit behavior, ID format, persistence layer, test strategy. A prompt-only run produces a plausible but essentially unconstrained implementation — correct-looking, not verifiably correct against this codebase's own rules. |
| **Tier 2 (+ CLAUDE.md memory)** | Cross-cutting conventions became fixed: `entity.verb` audit actions written via `AuditService.record`, actor sourced from `X-Actor`, `BadRequestException` naming the offending field, IDs via `newId()`, repository-only DB access, and dialect-neutral (Postgres/SQLite dual-database) column constraint. | **Feature-specific business logic was still undecided:** Exact validation rules for tags (max count? case? deduplication?), exact request/response shape for canned responses, filter semantics (`?tag=` exact vs. substring, case handling), pagination interaction, idempotency of applying a canned response, audit `details` payload shape. *CLAUDE.md governs how this codebase is built, not what this feature does.* |
| **Tier 3 (+ specs/canned-responses-tags.md)** | **25 deterministic, numbered ACs**, each traceable to a passing test named after its AC ID (69 → 71 tests after invariant pass, full suite green). Interrogation closed real gaps: comment `author` source, tag trimming/character rules, default `tags: []` at creation, exact-match vs. substring filtering, 404 precedence, and pagination `meta.total` semantics. | A handful of items were *deliberately* left to implementer judgment in Open Questions (ID prefix, exact audit action names, canned-response title uniqueness, tag storage encoding, GET `/canned-responses` pagination) — by design, these don't affect observable behavior. However, one item turned out to be a critical spec/process gap (see below). |

---

## 2. The One Decision That Still Varies Under Tier 3

### Pinpoint: Storage Strategy for Canned Responses
The spec's *Open Questions* section anticipated ambiguity in tag storage encoding (`delimited varchar` vs. `join table` — implementer's call), but said nothing about canned-response persistence, implicitly assuming canned responses would be a normal persisted entity.

However, the pre-existing test harness built during the "write tests" step hardcodes the `TestingModule` configuration (`controllers: [TicketsController]`, `providers: [TicketsService, TicketsRepository, AuditService]`, `entities: [Ticket, TicketComment, AuditEntry]`) with a strict rule not to modify test files. That wiring leaves no slot or DI repository for a `CannedResponse` entity. The only way to make the tests pass was to store canned responses in a plain in-memory array inside `TicketsRepository` — meaning canned responses **do not survive an app restart** in production.

### Judgment: Spec / Process GAP (Not a clean Implementer's Call)
A genuine implementer's call is one where either choice is behaviorally equivalent and only the encoding differs (e.g., `simple-json` vs. `simple-array` vs. `join table` for tag storage all produce the exact same API behavior).

In contrast, real persistence vs. in-memory storage produces materially different product behavior (canned responses silently vanishing on every deploy). The right move on discovering the test-harness constraint would have been to pause and either:
1. Get sign-off to loosen the "don't modify test files" constraint so a real `CannedResponse` entity could be wired in, or
2. Add an explicit spec note: *"v0 canned responses are in-memory and non-persistent for this course exercise."*

Neither happened — it was implemented and reported without flagging the persistence consequence as a decision needing a human call, which is exactly the failure mode specs are supposed to prevent.