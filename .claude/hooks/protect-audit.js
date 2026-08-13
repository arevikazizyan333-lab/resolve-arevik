const path = require('path');
const fs = require('fs');

let input = '';

process.stdin.on('data', chunk => {
  input += chunk;
});

process.stdin.on('end', () => {
  let filePath = '';

  try {
    const data = JSON.parse(input);
    filePath = data.tool_input?.file_path || '';
  } catch (e) {
    // Fail open: JSON parsing error -> exit 0
    process.exit(0);
  }

  if (filePath) {
    // 1. Resolve to absolute path and normalize path separators / relative parts (..)
    let absolutePath = path.resolve(filePath);

    // 2. Resolve symlinks if file/directory exists
    try {
      if (fs.existsSync(absolutePath)) {
        absolutePath = fs.realpathSync(absolutePath);
      }
    } catch (e) {
      // ignore
    }

    // 3. Convert to lowercase for case-insensitive checks
    const normalizedPath = absolutePath.toLowerCase();

    // Target folder to protect (in lowercase, normalized)
    const protectedDir = path.resolve('src/audit').toLowerCase();

    // Check if path starts with protected directory
    if (normalizedPath.startsWith(protectedDir) || normalizedPath.includes(`${path.sep}src${path.sep}audit`)) {
      console.error(
        'POLICY VIOLATION: Files in src/audit/ contain core compliance logic and immutable record handling. ' +
        'Direct edits are blocked to maintain audit integrity. To modify this domain, submit an Architecture Proposal ' +
        'and update the corresponding core schema first - explain this restriction and the required workflow to the user.'
      );
      process.exit(2);
    }
  }

  process.exit(0);
});