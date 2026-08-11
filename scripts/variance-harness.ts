import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const NUM_RUNS = 3; 
const PROMPT = "Add a new endpoint GET /tickets/:id/history in TicketsController that aggregates ticket audit entries and comments ordered by createdAt ascending. Add unit tests in tickets.service.spec.ts.";
const WORKTREE_PREFIX = 'harness-run-';
const REPORT_FILE = 'variance-report.json';

function runCmd(cmd: string, cwd?: string): string {
  try {
    return execSync(cmd, { cwd: cwd || process.cwd(), encoding: 'utf8', stdio: 'pipe' });
  } catch (error: any) {
    return error.stdout || error.message || '';
  }
}

function cleanupWorktrees() {
  console.log('🧹 Cleaning up previous worktrees...');
  for (let i = 1; i <= NUM_RUNS; i++) {
    const dir = path.join(process.cwd(), `${WORKTREE_PREFIX}${i}`);
    const branch = `${WORKTREE_PREFIX}${i}-branch`;
    runCmd(`git worktree remove "${dir}" --force`);
    runCmd(`git branch -D ${branch}`);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runVarianceHarness() {
  cleanupWorktrees();
  const diffs: { [key: string]: string } = {};
  console.log(`🚀 Starting Variance Test across ${NUM_RUNS} worktrees...`);

  for (let i = 1; i <= NUM_RUNS; i++) {
    const worktreePath = path.join(process.cwd(), `${WORKTREE_PREFIX}${i}`);
    const branchName = `${WORKTREE_PREFIX}${i}-branch`;

    console.log(`\n📂 Setting up Worktree #${i}...`);
    runCmd(`git worktree add -b ${branchName} "${worktreePath}"`);

    console.log(`🤖 Running Claude CLI in Worktree #${i}...`);
    runCmd(`npx @anthropic-ai/claude-code --dangerously-skip-permissions -p "${PROMPT}"`, worktreePath);

    console.log(`🔍 Capturing git diff for Worktree #${i}...`);
    runCmd(`git add -N .`, worktreePath);
    const diff = runCmd(`git diff`, worktreePath);
    diffs[`run_${i}`] = diff;
  }

  console.log('\n📊 Analyzing Variance...');
  const runs = Object.keys(diffs);
  let totalComparisons = 0;
  let identicalCount = 0;

  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      totalComparisons++;
      if (diffs[runs[i]].trim() === diffs[runs[j]].trim()) identicalCount++;
    }
  }

  const result = {
    timestamp: new Date().toISOString(),
    prompt: PROMPT,
    runsCount: NUM_RUNS,
    identicalDiffsRatio: `${identicalCount}/${totalComparisons}`,
    varianceScore: `${((1 - identicalCount / totalComparisons) * 100).toFixed(1)}%`,
    diffsSummary: Object.fromEntries(
      Object.entries(diffs).map(([key, value]) => {
        const trimmed = value.trim();
        return [key, { lineCount: trimmed === '' ? 0 : trimmed.split('\n').length }];
      })
    )
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(result, null, 2));
  console.log(`\n✅ Report saved to ${REPORT_FILE}`);
  cleanupWorktrees();
}

runVarianceHarness();