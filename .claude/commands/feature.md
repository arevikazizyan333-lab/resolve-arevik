---
description: Ship a small feature through explore -> plan -> implement -> test -> summary
argument-hint: [short feature description]
---

Feature request: $ARGUMENTS

Work through this feature in five explicit stages. Announce each stage as you enter it. Do not skip a stage, and do not start implementing before the plan stage is done.

## 1. Explore
Find every file this feature touches before writing anything: the entity/model, the service, the controller/route, the repository, and existing tests in the same area. Read them fully rather than guessing from names. Note existing conventions (naming, validation style, error types, how similar filters/fields are already implemented) so the new code matches the codebase rather than introducing a new pattern.

## 2. Plan
State in a few sentences: what changes, in which files, and why this is the smallest correct change. Flag anything ambiguous (e.g. an unclear field type, validation rule, or edge case) and resolve it before moving on — ask the user if it isn't derivable from the code.

## 3. Implement
Make the change. Follow the conventions found during Explore. No speculative abstractions, no unrelated refactors, no TODO stubs — the change should be complete and consistent across every layer it touches (entity, repository, service, controller).

## 4. Test
Add or update tests that exercise the new behavior using the project's existing test patterns, then run the test suite. If a test fails, fix the root cause, not the test. Do not report success without having actually run the tests.

## 5. Summary
Report concisely: what changed, which files, what was tested and the result. No speculative next steps unless something was explicitly deferred.
