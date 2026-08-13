#!/usr/bin/env node

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

    if (!command) {
      process.exit(0);
    }

    // 1. Block rm -rf / or rm -rf . or rm -rf ~
    // Checks if 'rm' with '-r' & '-f' targets root '/', '.', '~', or '/*'
    const isRm = /\brm\s+/.test(command) && /-[a-zA-Z]*r/.test(command) && /-[a-zA-Z]*f/.test(command);
    const targetsRoot = /\s+(\/|\.|\~|\/\*)\b/.test(command) || /\s+(\/|\.|\~|\/\*)$/.test(command);

    if (isRm && targetsRoot) {
      console.error(
        `BLOCKED: Destructive command detected ('${command}'). ` +
        `Deleting system root or current root directory is prohibited.`
      );
      process.exit(2); // BLOCK
    }

    // 2. Block force push to main/master
    const isGitForce = /\bgit\s+push\b/.test(command) && /(-f|--force)\b/.test(command);
    const isMainBranch = /\b(main|master)\b/.test(command);

    if (isGitForce && isMainBranch) {
      console.error(
        `BLOCKED: Force pushing to main/master branch is prohibited. ` +
        `Force push is only allowed on feature branches.`
      );
      process.exit(2); // BLOCK
    }

    process.exit(0);

  } catch (err) {
    // Return 0 for fail open, but now we know if JSON parsing failed
    process.exit(0);
  }
});