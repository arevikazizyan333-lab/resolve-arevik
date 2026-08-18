"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const NUM_RUNS = 3;
const PROMPT = "Add a new endpoint GET /tickets/:id/history in TicketsController that aggregates ticket audit entries and comments ordered by createdAt ascending. Add unit tests in tickets.service.spec.ts.";
const WORKTREE_PREFIX = 'harness-run-';
const REPORT_FILE = 'variance-report.json';
function runCmd(cmd, cwd) {
    try {
        return (0, child_process_1.execSync)(cmd, { cwd: cwd || process.cwd(), encoding: 'utf8', stdio: 'pipe' });
    }
    catch (error) {
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
        if (fs.existsSync(dir))
            fs.rmSync(dir, { recursive: true, force: true });
    }
}
function runVarianceHarness() {
    cleanupWorktrees();
    const diffs = {};
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
            if (diffs[runs[i]].trim() === diffs[runs[j]].trim())
                identicalCount++;
        }
    }
    const result = {
        timestamp: new Date().toISOString(),
        prompt: PROMPT,
        runsCount: NUM_RUNS,
        identicalDiffsRatio: `${identicalCount}/${totalComparisons}`,
        varianceScore: `${((1 - identicalCount / totalComparisons) * 100).toFixed(1)}%`,
        diffsSummary: Object.fromEntries(Object.entries(diffs).map(([key, value]) => {
            const trimmed = value.trim();
            return [key, { lineCount: trimmed === '' ? 0 : trimmed.split('\n').length }];
        }))
    };
    fs.writeFileSync(REPORT_FILE, JSON.stringify(result, null, 2));
    console.log(`\n✅ Report saved to ${REPORT_FILE}`);
    cleanupWorktrees();
}
runVarianceHarness();
//# sourceMappingURL=variance-harness.js.map