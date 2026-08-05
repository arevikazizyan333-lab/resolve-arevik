#!/usr/bin/env node
let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const data = JSON.parse(input);
  const filePath = data.tool_input?.file_path;
  if (filePath && (filePath.includes('src/audit/') || filePath.includes('src\\audit\\'))) {
    console.error('Access denied: src/audit/ is protected');
    process.exit(2);
  }
  process.exit(0);
});
