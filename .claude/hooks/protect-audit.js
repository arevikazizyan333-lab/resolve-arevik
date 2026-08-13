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

  // Check if file is inside src/audit/ (handling both / and \ for Windows)
  if (filePath && (filePath.includes('src/audit/') || filePath.includes('src\\audit\\'))) {
  console.error(
    'POLICY VIOLATION: Files in src/audit/ contain core compliance logic and immutable record handling. ' +
    'Direct edits are blocked to maintain audit integrity. To modify this domain, submit an Architecture Proposal ' +
    'and update the corresponding core schema first - explain this restriction and the required workflow to the user.'
  );
  process.exit(2);
}

  process.exit(0);
});