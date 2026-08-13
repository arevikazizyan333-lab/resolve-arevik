#!/usr/bin/env node
// PreToolUse hook - blocks any edit to the audit module.
//
// The harness runs this BEFORE the agent's edit happens.
// exit 0 -> allow
// exit 2 -> BLOCK (stderr is sent to the model)
// any other exit code -> error shown to you, and the edit PROCEEDS

let input = '';

// The tool call arrives as JSON on stdin.
process.stdin.on('data', (chunk) => { input += chunk; });

process.stdin.on('end', () => {
  let filePath = '';

  try {
    const data = JSON.parse(input);
    filePath = data.tool_input?.file_path ?? '';
  } catch {
    // FAIL OPEN: our bug must never become their outage.
    process.exit(0);
  }

  // Check for both POSIX (/) and Windows (\) path separators
  if (filePath && (filePath.includes('src/audit/') || filePath.includes('src\\audit\\'))) {
    // This message is the only thing the model learns from.
    // "Blocked" makes it retry. A reason makes it explain the rule back.
    console.error(
      'BLOCKED by team policy: src/audit/ is append-only. An audit trail ' +
      'you can edit is not an audit trail. Changing it requires an ADR ' +
      'and a migration - explain this to the user instead of editing.'
    );
    process.exit(2); // -> the block
  }

  process.exit(0); // -> everything else is allowed
});
