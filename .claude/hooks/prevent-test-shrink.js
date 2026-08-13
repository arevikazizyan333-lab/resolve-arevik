const fs = require('fs');

let input = '';

process.stdin.on('data', chunk => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name || data.tool;
    const toolInput = data.tool_input || {};

    const filePath = toolInput.file_path || toolInput.path || '';

    // 1. Make sure it's a test file (*.spec.ts, *.test.ts ...)
    const isTestFile = /\.(test|spec)\.[jt]sx?$/.test(filePath);

    if (isTestFile) {
      // helper function to count the number of test cases in a string
      const countTests = (str) => {
        if (!str) return 0;
        const matches = str.match(/\b(it|test)\s*\(/g);
        return matches ? matches.length : 0;
      };

      let oldCount = 0;
      let newCount = 0;

      // 2.If the tool is Edit, count tests in old_string and new_string
      if (toolName === 'Edit') {
        oldCount = countTests(toolInput.old_string || '');
        newCount = countTests(toolInput.new_string || '');
      } 
      // 3. if the tool is Write, count tests in content and compare with existing file
      else if (toolName === 'Write') {
        newCount = countTests(toolInput.content || '');

        if (fs.existsSync(filePath)) {
          const existingContent = fs.readFileSync(filePath, 'utf-8');
          oldCount = countTests(existingContent);
        }
      }

      // 4. If the number of tests has decreased -> BLOCK
      if (newCount < oldCount) {
        console.error(
          `POLICY VIOLATION: An edit to a test file may add tests, never remove them. ` +
          `Previous count: ${oldCount}, New count: ${newCount}.`
        );
        process.exit(2);
      }
    }

    process.exit(0);
  } catch (e) {
    process.exit(0);
  }
});