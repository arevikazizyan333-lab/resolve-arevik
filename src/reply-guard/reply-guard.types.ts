export type Severity = 'HIGH' | 'MEDIUM';

export type Verdict = 'SEND' | 'REVISE' | 'ESCALATE';

// Internal-only categorization used to compute the verdict (AC-6/AC-7/AC-8).
// Not part of the public API contract — never surfaced on `Finding`.
export type FindingCategory = 'disclosure' | 'commitment' | 'answer' | 'tone';

export interface Finding {
  severity: Severity;
  issue: string;
  quote: string;
}

export interface CheckReplyResponse {
  verdict: Verdict;
  findings: Finding[];
  confidence: number;
  reasoning: string;
  injectionSuspected: boolean;
  requiresHuman: true; // INV-1: always true, regardless of verdict
}
