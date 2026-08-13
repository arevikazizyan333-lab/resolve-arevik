---
description: Investigate a reported bug against the code and uncommitted diff, and produce a structured bug report without changing anything.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(git diff:*)
---

# Instructions
Given a bug description (from $ARGUMENTS or the conversation), investigate it:
1. Locate the relevant code path (controller/service/repository/entity) via Grep/Glob and read it in full.
2. Check `git diff` for any uncommitted changes that might be implicated.
3. Trace the suspected root cause to specific files and line ranges — don't stop at symptoms.
4. Identify the blast radius: what else calls this code, what invariants or conventions (per CLAUDE.md) it violates.
5. Note reproduction steps or conditions if they can be derived from the code (inputs, state, sequence of calls).

# Rules & Constraints
- Report only, fix nothing.
- Do not write or edit tests.
- Do not edit or create any files.
- Do not run any tool outside the allowed-tools list above.

# Output Format
Strictly follow this template, fenced exactly as shown:

```markdown
## Bug Report

### 1. Summary
[1-2 sentence description of the bug and its observable symptom]

### 2. Root Cause
- **File(s):** [path:line]
- **Explanation:** [what's actually wrong, not just where]

### 3. Reproduction
- [Steps or conditions that trigger it, or "Could not determine from static analysis"]

### 4. Blast Radius
- [Other callers/features affected, conventions or invariants violated, or "None identified"]

### 5. Severity & Verdict
[1-2 sentence assessment of impact and urgency]
```
