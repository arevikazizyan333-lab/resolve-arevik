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
      console.error(
        'BLOCKED: Direct commits to the main/master branch are strictly forbidden. ' +
        'Please checkout a feature branch before committing.'
      );
      process.exit(2); // BLOCK
    }

    process.exit(0);

  } catch (err) {
    // Fail open: allow the command through if anything goes wrong
    process.exit(0);
  }
});
