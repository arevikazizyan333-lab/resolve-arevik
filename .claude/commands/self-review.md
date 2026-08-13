---
description: Perform a hostile code review on uncommitted changes without modifying code.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(git status:*)
  - Bash(git diff:*)
  - Bash(git log:*)
---

# Instructions
Review the uncommitted git diff as a hostile reviewer. Look specifically for:
1. Violations of project conventions.
2. Invented/unnecessary custom behavior.
3. Weak or missing tests.
4. Missing edge cases.

# Rules & Constraints
- Report only, fix nothing.
- Do not edit or create any files.
- Do not run any tool outside the allowed-tools list above.

# Output Format
Strictly follow this template, fenced exactly as shown:

```markdown
## Self-Review Report

### 1. Conventions & Code Style
- [List issues or "None identified"]

### 2. Invented Behavior / Over-engineering
- [List issues or "None identified"]

### 3. Test Coverage & Edge Cases
- [List issues or "None identified"]

### 4. Summary & Verdict
[1-2 sentence overall summary]
```
