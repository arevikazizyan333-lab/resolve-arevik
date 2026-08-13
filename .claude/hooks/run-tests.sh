#!/usr/bin/env bash
# PostToolUse hook - runs the suite after source edits.
#
# PostToolUse fires AFTER the edit. We can't prevent it, but exit 2 sends
# our stderr to the model - so it learns it broke something without being
# asked to check.

set -uo pipefail
raw=$(cat)

# Pull file_path out of the tool-call JSON
path=$(printf '%s' "$raw" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

# Only react to source files -- docs and config edits shouldn't cost a test run
case "$path" in
  *.ts|*.tsx|*.js) ;;
  *) exit 0 ;;
esac

case "$path" in
  *node_modules*|*/dist/*) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0   # CLAUDE_PROJECT_DIR = repo root
[ -f package.json ] || exit 0

if ! output=$(npm test --silent 2>&1); then
  echo "Tests are RED after your edit to ${path}:" >&2
  printf '%s\n' "$output" | tail -20 >&2
  echo "Fix this before continuing." >&2
  exit 2                                   # tell the model, don't stay silent
fi

exit 0