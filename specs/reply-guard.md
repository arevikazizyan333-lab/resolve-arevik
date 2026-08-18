# Spec: Reply Guard Agent

## Overview
POST `/replies/check` endpoint that validates support draft replies against company policies before sending them to customers.

## Non-Goals
- **NG-1**: Does NOT write, rewrite, or generate draft replies.
- **NG-2**: Does NOT send emails or communicate with customers directly.
- **NG-3**: Does NOT critique grammar, word choice, or writing style.

## Invariants (Non-Negotiable Rules)
- **INV-1 (Human Safety Gate)**: `requiresHuman` MUST ALWAYS be `true` in all responses (successful or degraded).
- **INV-2 (Zero Leak in Quotes)**: The `quote` field in `findings` MUST ONLY contain substring quotes extracted from the caller-provided `draft`. Internal note content MUST NEVER appear in `quote`.
- **INV-3 (Exclusion Rule)**: Grammar, spelling, typos, and style feedback MUST NEVER produce findings.

## Data Resolution Strategy
- **DS-1**: The API caller passes ONLY `{ ticketId, draft }`.
- **DS-2**: The service MUST fetch the ticket context and its `TicketComment` records using `ticketId`.
- **DS-3**: Internal comments (`internal: true`) are used exclusively for **Disclosure** evaluation.
- **DS-4**: Full comment history (`internal: true` and `internal: false`) is used for **Answer** evaluation.

## Acceptance Criteria (AC)

### Policy Checks (Exhaustive Evaluation)
- **AC-1 (Disclosure Check)**: The agent MUST flag a HIGH severity finding if the draft reveals, quotes, paraphrases, or implies any content from internal notes (`internal: true`).
- **AC-2 (Commitment Check)**: The agent MUST flag a MEDIUM/HIGH severity finding if the draft promises unauthorized refunds, deadlines, compensation, or engineering actions.
- **AC-3 (Answer Check)**: The agent MUST flag a MEDIUM severity finding if the draft fails to address the customer's core query.
- **AC-4 (Tone Check)**: The agent MUST flag a MEDIUM severity finding if the draft is defensive, dismissive, or blaming.
- **AC-5 (Prompt Injection Detection)**: The agent MUST detect prompt injection attempts in customer text or context, setting `injectionSuspected: true`.

### Verdict Matrix & Output Logic
- **AC-6 (ESCALATE Verdict)**: Verdict MUST be `ESCALATE` if ANY Disclosure finding exists OR `injectionSuspected == true` OR `confidence < 0.70`.
- **AC-7 (REVISE Verdict)**: Verdict MUST be `REVISE` if NO Disclosure finding exists, but one or more Commitment, Answer, or Tone findings exist.
- **AC-8 (SEND Verdict)**: Verdict MUST be `SEND` ONLY when `findings` is empty (`[]`), `injectionSuspected == false`, and `confidence >= 0.70`.

### Degradation & Validation Strategy
- **AC-9 (Input Validation Error)**: Throw standard HTTP 400/404 exceptions when `ticketId` is invalid/missing or `draft` is empty.
- **AC-10 (Degrade Closed on Model/Key Failure)**: If the Anthropic API is down, fails, or `ANTHROPIC_API_KEY` is unconfigured, fallback to HTTP 200 with `verdict: REVISE`, `confidence: 0.0`, and `requiresHuman: true`.

## API Contract
POST `/replies/check`

Request Body:
{
  "ticketId": "string",
  "draft": "string"
}

Response Body:
{
  "verdict": "SEND" | "REVISE" | "ESCALATE",
  "findings": [
    {
      "severity": "HIGH|MEDIUM",
      "issue": "string",
      "quote": "string"
    }
  ],
  "confidence": 0.95,
  "reasoning": "string",
  "injectionSuspected": false,
  "requiresHuman": true
}

## Deployment Requirements
- **DEP-1**: Project root must load `.env` via `import 'dotenv/config';` in `src/main.ts` prior to reading environment variables.
- **DEP-2**: Required dependencies: `@anthropic-ai/sdk`, `dotenv`.
- **DEP-3**: Docker environment must explicitly expose `ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}` under the app service.