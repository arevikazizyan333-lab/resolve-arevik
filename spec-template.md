# Specification template

A spec is a **contract with a projection into tests**. If an acceptance
criterion can't become an assertion, it isn't finished.

Copy to `specs/<feature>.md`. Delete sections that don't apply — but
think twice before deleting Non-goals; it's the cheapest defect
prevention in this document.

---

```markdown
# [ID] — [Feature name]

## Context

[2–3 lines: what problem, for whom, why now. This prevents the agent
from "helpfully" reinterpreting the feature into something else.]

## Acceptance criteria

<!-- Numbered, atomic, observable at an API boundary. Each one must be
     assertable. Write them so a test name can quote them verbatim. -->

- **AC-1** — [Given/when/then, or a plain checkable statement]
- **AC-2** — …
- **AC-3** — …

## Invariants

<!-- Not scenarios: properties that hold in EVERY state, after every
     operation. These become property tests or repeated assertions. -->

- [e.g. "total refunded never exceeds captured amount"]
- [e.g. "every status change has exactly one audit entry"]

## Constraints

- Follow the conventions in CLAUDE.md
- [No new dependencies / perf bound / security requirement / API
  compatibility rule]

## Non-goals

<!-- Explicit, with reasons. Agents are enthusiastic; this is the fence. -->

- [Thing that sounds related but is out of scope] — [why / where it lives]

## Open questions

<!-- What you DELIBERATELY leave to implementation judgment, and what is
     still blocked on a human decision. Anything blocked is not ready to
     implement. -->

- [Deliberate: "response shape of the list endpoint — implementer's call"]
- [Blocked: "does reopening reset SLA? — needs support lead"]

## Definition of done

- Every AC covered by at least one test whose name cites the AC id
- Invariants covered by tests
- Full suite green
- [Docs/README updated if the public API changed]
```

---

## Writing AC that agents can execute

| Weak | Executable |
|---|---|
| "Reopening should work smoothly" | **AC-1** — `POST /tickets/:id/reopen` on a `resolved` ticket returns 200 and sets status to `open` |
| "Don't allow old tickets to reopen" | **AC-4** — reopening a ticket resolved more than 7 days ago returns 400 with a message naming the window |
| "Track who did it" | **AC-6** — every reopen writes an audit entry `ticket.reopened` with the `X-Actor` value and the previous status |
| "Handle errors" | **AC-7** — reopening a ticket in any status other than `resolved` returns 400 listing the allowed source states |

Rules: one behavior per AC · include the failure modes, not just the
happy path · name the observable (status code, field, audit action) ·
never name a class or method — that's implementation.

## The interrogation step (do this before implementing)

Run `/interrogate specs/<file>.md` (or paste the prompt from
`interrogate-spec.md`). Fix what it finds, then implement. Typical yield
on a first-draft spec: **3–8 real gaps**, most of them edge semantics
nobody discussed.

## Traceability

- Test names cite AC ids: `it('AC-4: rejects reopen after 7 days', ...)`
- PR description lists the AC ids it implements
- Coverage of requirements becomes a grep, not a meeting