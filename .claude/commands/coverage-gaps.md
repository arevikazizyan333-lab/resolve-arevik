---
description: Read spec and test suite to list AC without tests, implementation assertions, and the highest-value missing test.
allowed-tools:
  - Read
  - Grep
  - Glob
---

# Instructions
Locate the relevant spec (e.g. `specs/<feature>.md`, following the format in `spec-template.md`) and its corresponding test files. Cross-reference every acceptance criterion (`AC-1`, `AC-2`, ...) against the test suite:
1. For each AC, search the tests for an assertion that cites its id (per the `it('AC-N: ...')` convention) or otherwise clearly covers it.
2. Note any test assertions that check implementation shape (internal method calls, private state, class structure) rather than observable behavior at the API boundary.
3. Identify every AC and invariant with no covering test.
4. From the gaps found, pick the single highest-value missing test — the one whose absence poses the greatest risk — and explain why.

# Rules & Constraints
- Report only, fix nothing.
- Do not write tests.
- Do not edit any files.
- Do not run any tool outside the allowed-tools list above.

# Output Format
Strictly follow this template, fenced exactly as shown:

```markdown
## Coverage Gaps Report

### 1. Untested Acceptance Criteria
- [AC id + statement, or "None identified"]

### 2. Implementation-Shape Assertions
- [Test name + what it asserts against implementation instead of behavior, or "None identified"]

### 3. Highest-Value Missing Test
- **AC/Invariant:** [id or description]
- **Why it matters:** [1-2 sentences]
- **Suggested test name:** [e.g. "AC-4: rejects reopen after 7 days"]
```
