#!/usr/bin/env node

const { execSync } = require('child_process');

let input = '';

process.stdin.on('data', chunk => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    if (!input.trim()) {
      process.exit(0);
    }

    const data = JSON.parse(input);
    const toolInput = data.tool_input || {};
    const command = toolInput.command || '';

    if (!command || !command.includes('git commit')) {
      process.exit(0);
    }

    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();

    if (branch === 'main' || branch === 'master') {
    // Instead of exit 2 + console.error, we return a JSON payload in 'ask' mode
      const response = {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "ask",
          permissionDecisionReason: `Direct commits to '${branch}' are discouraged. Confirm if this is an intentional hotfix.`
        }
      };

      console.log(JSON.stringify(response));
      process.exit(0); // JSON output is expected to be printed to stdout, so we exit with 0 to indicate success
    }

    process.exit(0);

  } catch (err) {
    // Fail open: allow the command through if anything goes wrong
    process.exit(0);
  }
});
