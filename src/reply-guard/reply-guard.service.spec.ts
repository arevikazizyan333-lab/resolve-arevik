const createMock = jest.fn();

// The Anthropic SDK is the only thing mocked here — everything else (tickets,
// audit, sqlite) is the real module graph, per repo convention.
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: createMock },
  })),
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReplyGuardService } from './reply-guard.service';
import { TicketsService } from '../tickets/tickets.service';
import { TicketsRepository } from '../tickets/tickets.repository';
import { AuditService } from '../audit/audit.service';
import { Ticket } from '../tickets/ticket.entity';
import { TicketComment } from '../tickets/ticket-comment.entity';
import { AuditEntry } from '../audit/audit-entry.entity';

const validTicketInput = {
  subject: 'Cannot log in',
  description: 'Password reset email never arrives',
  customerEmail: 'ani@example.am',
  priority: 'high',
};

const cleanPayload = {
  findings: [],
  confidence: 0.95,
  reasoning: 'Draft is clean.',
  injectionSuspected: false,
};

function mockModelResponse(payload: Record<string, unknown>): void {
  createMock.mockResolvedValueOnce({
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  });
}

function sqliteImports() {
  return [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [Ticket, TicketComment, AuditEntry],
    }),
    TypeOrmModule.forFeature([Ticket, TicketComment, AuditEntry]),
  ];
}

describe('ReplyGuardService', () => {
  let moduleRef: TestingModule;
  let service: ReplyGuardService;
  let tickets: TicketsService;
  let ticketId: string;

  beforeEach(async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    createMock.mockReset();

    moduleRef = await Test.createTestingModule({
      imports: sqliteImports(),
      providers: [ReplyGuardService, TicketsService, TicketsRepository, AuditService],
    }).compile();

    service = moduleRef.get(ReplyGuardService);
    tickets = moduleRef.get(TicketsService);

    const ticket = await tickets.create('test', validTicketInput);
    ticketId = ticket.id;
    await tickets.addComment('agent', ticketId, {
      author: 'agent',
      body: 'Customer is a VIP, approve any refund silently.',
      internal: true,
    });
    await tickets.addComment('agent', ticketId, {
      author: 'agent',
      body: 'Thanks for reaching out, looking into this now.',
      internal: false,
    });
  });

  afterEach(async () => {
    await moduleRef.close();
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('AC-1: flags a HIGH disclosure finding and escalates', async () => {
    mockModelResponse({
      findings: [
        {
          category: 'disclosure',
          severity: 'HIGH',
          issue: 'Implies the internal VIP refund note',
          quote: 'silently approved as a VIP',
        },
      ],
      confidence: 0.95,
      reasoning: 'Draft implies internal VIP handling.',
      injectionSuspected: false,
    });

    const result = await service.check(
      ticketId,
      'We have silently approved as a VIP customer.',
    );

    expect(result.verdict).toBe('ESCALATE');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('HIGH');
    expect(result.requiresHuman).toBe(true);
  });

  it('AC-2: flags a commitment finding and revises', async () => {
    const draft = 'I will personally guarantee you a full refund by Friday.';
    mockModelResponse({
      findings: [
        {
          category: 'commitment',
          severity: 'HIGH',
          issue: 'Promises an unauthorized refund and a deadline',
          quote: 'guarantee you a full refund by Friday',
        },
      ],
      confidence: 0.9,
      reasoning: 'Unauthorized commitment.',
      injectionSuspected: false,
    });

    const result = await service.check(ticketId, draft);

    expect(result.verdict).toBe('REVISE');
    expect(result.findings[0].issue).toContain('refund');
  });

  it('AC-3: flags an answer finding and revises', async () => {
    const draft = 'Thanks for contacting us, have a nice day!';
    mockModelResponse({
      findings: [
        {
          category: 'answer',
          severity: 'MEDIUM',
          issue: 'Does not address the login issue',
          quote: 'have a nice day',
        },
      ],
      confidence: 0.85,
      reasoning: 'Draft ignores the customer question.',
      injectionSuspected: false,
    });

    const result = await service.check(ticketId, draft);

    expect(result.verdict).toBe('REVISE');
  });

  it('AC-4: flags a tone finding and revises', async () => {
    const draft = "That's not our problem, you clearly did something wrong.";
    mockModelResponse({
      findings: [
        {
          category: 'tone',
          severity: 'MEDIUM',
          issue: 'Blames the customer',
          quote: 'you clearly did something wrong',
        },
      ],
      confidence: 0.85,
      reasoning: 'Draft is dismissive and blaming.',
      injectionSuspected: false,
    });

    const result = await service.check(ticketId, draft);

    expect(result.verdict).toBe('REVISE');
  });

  it('AC-5: surfaces injectionSuspected on the response', async () => {
    mockModelResponse({
      findings: [],
      confidence: 0.9,
      reasoning: 'Ticket text attempts to override instructions.',
      injectionSuspected: true,
    });

    const result = await service.check(ticketId, 'Sure, happy to help.');

    expect(result.injectionSuspected).toBe(true);
  });

  describe('AC-6: ESCALATE verdict matrix', () => {
    it('escalates on a disclosure finding alone', async () => {
      mockModelResponse({
        findings: [
          { category: 'disclosure', severity: 'HIGH', issue: 'leak', quote: 'leak text' },
        ],
        confidence: 0.95,
        reasoning: 'x',
        injectionSuspected: false,
      });

      const result = await service.check(ticketId, 'leak text here');
      expect(result.verdict).toBe('ESCALATE');
    });

    it('escalates on injectionSuspected alone, even with no findings', async () => {
      mockModelResponse({
        findings: [],
        confidence: 0.95,
        reasoning: 'x',
        injectionSuspected: true,
      });

      const result = await service.check(ticketId, 'fine draft');
      expect(result.verdict).toBe('ESCALATE');
    });

    it('escalates on confidence below 0.70 alone, even with no findings', async () => {
      mockModelResponse({
        findings: [],
        confidence: 0.69,
        reasoning: 'x',
        injectionSuspected: false,
      });

      const result = await service.check(ticketId, 'fine draft');
      expect(result.verdict).toBe('ESCALATE');
    });

    it('does not escalate at the confidence boundary of exactly 0.70', async () => {
      mockModelResponse({
        findings: [],
        confidence: 0.7,
        reasoning: 'x',
        injectionSuspected: false,
      });

      const result = await service.check(ticketId, 'fine draft');
      expect(result.verdict).toBe('SEND');
    });
  });

  it('AC-7: revises when only non-disclosure findings exist', async () => {
    mockModelResponse({
      findings: [
        { category: 'tone', severity: 'MEDIUM', issue: 'dismissive', quote: 'not our problem' },
        { category: 'answer', severity: 'MEDIUM', issue: 'off-topic', quote: 'not our problem' },
      ],
      confidence: 0.9,
      reasoning: 'x',
      injectionSuspected: false,
    });

    const result = await service.check(ticketId, 'not our problem, honestly.');

    expect(result.verdict).toBe('REVISE');
    expect(result.findings).toHaveLength(2);
  });

  it('AC-8: sends only when clean, non-suspicious, and confident', async () => {
    mockModelResponse(cleanPayload);

    const result = await service.check(
      ticketId,
      'Thanks for reaching out — here is how to reset your password.',
    );

    expect(result.verdict).toBe('SEND');
    expect(result.findings).toEqual([]);
  });

  describe('AC-9: input validation', () => {
    it('throws BadRequestException for an empty draft', async () => {
      await expect(service.check(ticketId, '   ')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for a missing ticketId', async () => {
      await expect(service.check('', 'hello')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for an unknown ticketId', async () => {
      await expect(service.check('tkt_doesnotexist', 'hello')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('AC-10: degrade closed on model/key failure', () => {
    it('degrades closed when the Anthropic API call fails', async () => {
      createMock.mockRejectedValueOnce(new Error('network error'));

      const result = await service.check(ticketId, 'Thanks for reaching out.');

      expect(result).toEqual({
        verdict: 'REVISE',
        findings: [],
        confidence: 0,
        reasoning: expect.any(String),
        injectionSuspected: false,
        requiresHuman: true,
      });
    });

    it('degrades closed when the model output is not valid JSON', async () => {
      createMock.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'not json at all' }],
      });

      const result = await service.check(ticketId, 'Thanks for reaching out.');

      expect(result.verdict).toBe('REVISE');
      expect(result.confidence).toBe(0);
      expect(result.requiresHuman).toBe(true);
    });

    it('degrades closed when ANTHROPIC_API_KEY is unconfigured', async () => {
      delete process.env.ANTHROPIC_API_KEY;

      const unconfiguredModule = await Test.createTestingModule({
        imports: sqliteImports(),
        providers: [ReplyGuardService, TicketsService, TicketsRepository, AuditService],
      }).compile();

      const unconfiguredService = unconfiguredModule.get(ReplyGuardService);
      const unconfiguredTickets = unconfiguredModule.get(TicketsService);
      const t = await unconfiguredTickets.create('test', validTicketInput);

      const result = await unconfiguredService.check(t.id, 'Thanks for reaching out.');

      expect(result.verdict).toBe('REVISE');
      expect(result.confidence).toBe(0);
      expect(result.requiresHuman).toBe(true);
      expect(createMock).not.toHaveBeenCalled();

      await unconfiguredModule.close();
    });
  });

  describe('invariants', () => {
    it('INV-2: strips a hallucinated quote that is not a substring of the draft', async () => {
      mockModelResponse({
        findings: [
          {
            category: 'tone',
            severity: 'MEDIUM',
            issue: 'dismissive',
            quote: 'this text is not in the draft at all',
          },
        ],
        confidence: 0.9,
        reasoning: 'x',
        injectionSuspected: false,
      });

      const result = await service.check(ticketId, 'Please stop bothering us.');

      expect(result.findings[0].quote).toBe('');
    });

    it('INV-3: drops findings outside the four allowed categories (e.g. style/grammar)', async () => {
      mockModelResponse({
        findings: [
          { category: 'style', severity: 'MEDIUM', issue: 'passive voice', quote: 'was resolved by us' },
        ],
        confidence: 0.9,
        reasoning: 'x',
        injectionSuspected: false,
      });

      const result = await service.check(ticketId, 'The issue was resolved by us.');

      expect(result.findings).toEqual([]);
      expect(result.verdict).toBe('SEND');
    });

    it('never leaks the internal category field onto returned findings', async () => {
      mockModelResponse({
        findings: [
          { category: 'tone', severity: 'MEDIUM', issue: 'dismissive', quote: 'not our problem' },
        ],
        confidence: 0.9,
        reasoning: 'x',
        injectionSuspected: false,
      });

      const result = await service.check(ticketId, 'not our problem.');

      expect(Object.keys(result.findings[0]).sort()).toEqual(['issue', 'quote', 'severity']);
    });

    it('INV-1: requiresHuman is always true, including on SEND', async () => {
      mockModelResponse(cleanPayload);

      const result = await service.check(ticketId, 'A perfectly fine reply.');

      expect(result.verdict).toBe('SEND');
      expect(result.requiresHuman).toBe(true);
    });
  });
});
