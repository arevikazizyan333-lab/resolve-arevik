import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsRepository } from './tickets.repository';
import { AuditService } from '../audit/audit.service';
import { Ticket } from './ticket.entity';
import { TicketComment } from './ticket-comment.entity';
import { AuditEntry } from '../audit/audit-entry.entity';

describe('TicketsService', () => {
  let moduleRef: TestingModule;
  let service: TicketsService;
  let audit: AuditService;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          dropSchema: true,
          synchronize: true,
          entities: [Ticket, TicketComment, AuditEntry],
        }),
        TypeOrmModule.forFeature([Ticket, TicketComment, AuditEntry]),
      ],
      providers: [TicketsService, TicketsRepository, AuditService],
    }).compile();

    service = moduleRef.get(TicketsService);
    audit = moduleRef.get(AuditService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  const valid = {
    subject: 'Cannot log in',
    description: 'Password reset email never arrives',
    customerEmail: 'ani@example.am',
    priority: 'high',
  };

  describe('validation', () => {
    it('creates a valid ticket in status new', async () => {
      const ticket = await service.create('test', valid);
      expect(ticket.status).toBe('new');
      expect(ticket.priority).toBe('high');
      expect(ticket.resolvedAt).toBeNull();
    });

    it.each([
      [{ ...valid, subject: '  ' }, 'subject'],
      [{ ...valid, description: '' }, 'description'],
      [{ ...valid, customerEmail: 'not-an-email' }, 'customerEmail'],
      [{ ...valid, priority: 'critical' }, 'priority'],
    ])('rejects invalid input naming the field', async (input, field) => {
      await expect(service.create('test', input)).rejects.toThrow(
        expect.objectContaining({ message: expect.stringContaining(field) }),
      );
    });
  });

  describe('status machine', () => {
    it('walks the full happy path', async () => {
      const t = await service.create('test', valid);
      for (const to of ['open', 'in_progress', 'resolved', 'closed']) {
        await service.changeStatus('test', t.id, to);
      }
      const final = await service.findById(t.id);
      expect(final.status).toBe('closed');
      expect(final.resolvedAt).not.toBeNull();
    });

    it('supports the waiting_customer loop', async () => {
      const t = await service.create('test', valid);
      await service.changeStatus('test', t.id, 'open');
      await service.changeStatus('test', t.id, 'in_progress');
      await service.changeStatus('test', t.id, 'waiting_customer');
      await service.changeStatus('test', t.id, 'in_progress');
      expect((await service.findById(t.id)).status).toBe('in_progress');
    });

    it('rejects new → resolved (no skipping)', async () => {
      const t = await service.create('test', valid);
      await expect(
        service.changeStatus('test', t.id, 'resolved'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects reopening a closed ticket', async () => {
      const t = await service.create('test', valid);
      for (const to of ['open', 'in_progress', 'resolved', 'closed']) {
        await service.changeStatus('test', t.id, to);
      }
      await expect(service.changeStatus('test', t.id, 'open')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('names the allowed next states in the error', async () => {
      const t = await service.create('test', valid);
      await expect(service.changeStatus('test', t.id, 'closed')).rejects.toThrow(
        expect.objectContaining({ message: expect.stringContaining('open') }),
      );
    });
  });

  describe('reopening', () => {
    it('reopens a resolved ticket back to open and clears resolvedAt', async () => {
      const t = await service.create('test', valid);
      await service.changeStatus('test', t.id, 'open');
      await service.changeStatus('test', t.id, 'in_progress');
      await service.changeStatus('test', t.id, 'resolved');
      const resolved = await service.findById(t.id);
      expect(resolved.resolvedAt).not.toBeNull();

      const reopened = await service.changeStatus('test', t.id, 'open');
      expect(reopened.status).toBe('open');
      expect(reopened.resolvedAt).toBeNull();
    });

    it('allows a reopened ticket to walk the workflow again', async () => {
      const t = await service.create('test', valid);
      for (const to of ['open', 'in_progress', 'resolved']) {
        await service.changeStatus('test', t.id, to);
      }
      await service.changeStatus('test', t.id, 'open');
      for (const to of ['in_progress', 'resolved', 'closed']) {
        await service.changeStatus('test', t.id, to);
      }
      const final = await service.findById(t.id);
      expect(final.status).toBe('closed');
      expect(final.resolvedAt).not.toBeNull();
    });

    it('rejects reopening tickets that are not resolved', async () => {
      const t = await service.create('test', valid);
      await service.changeStatus('test', t.id, 'open');
      await service.changeStatus('test', t.id, 'in_progress');
      await expect(service.changeStatus('test', t.id, 'open')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('still rejects reopening a closed ticket', async () => {
      const t = await service.create('test', valid);
      for (const to of ['open', 'in_progress', 'resolved', 'closed']) {
        await service.changeStatus('test', t.id, to);
      }
      await expect(service.changeStatus('test', t.id, 'open')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('records the reopen in the audit trail', async () => {
      const t = await service.create('narek', valid);
      for (const to of ['open', 'in_progress', 'resolved']) {
        await service.changeStatus('narek', t.id, to);
      }
      await service.changeStatus('narek', t.id, 'open');

      const entries = await audit.list(t.id);
      const last = entries[entries.length - 1];
      expect(last.action).toBe('ticket.status_changed');
      expect(last.details).toEqual({ from: 'resolved', to: 'open' });
    });
  });

  describe('comments', () => {
    it('adds public and internal comments in order', async () => {
      const t = await service.create('test', valid);
      await service.addComment('agent-1', t.id, {
        author: 'agent-1',
        body: 'Looking into it',
        internal: true,
      });
      await service.addComment('ani', t.id, {
        author: 'ani',
        body: 'Any update?',
        internal: false,
      });
      const ticket = await service.findById(t.id);
      expect(ticket.comments).toHaveLength(2);
      expect(ticket.comments[0].internal).toBe(true);
      expect(ticket.comments[1].author).toBe('ani');
    });

    it('rejects empty bodies', async () => {
      const t = await service.create('test', valid);
      await expect(
        service.addComment('x', t.id, { author: 'x', body: ' ' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('audit trail', () => {
    it('records creation, status changes, and comments with actors', async () => {
      const t = await service.create('narek', valid);
      await service.changeStatus('narek', t.id, 'open');
      await service.addComment('agent-1', t.id, { author: 'agent-1', body: 'hi' });

      const entries = await audit.list(t.id);
      expect(entries.map((e) => e.action)).toEqual([
        'ticket.created',
        'ticket.status_changed',
        'ticket.commented',
      ]);
      expect(entries[0].actor).toBe('narek');
      expect(entries[1].details).toEqual({ from: 'new', to: 'open' });
      expect(entries[2].actor).toBe('agent-1');
    });

    // Asserts the contract (seq strictly descending) rather than re-hardcoding
    // the fixture the test above already pins. The second ticket interleaves its
    // entries with this one's, so a trail that forgot to scope by id would come
    // back five long.
    it('returns only this ticket\'s trail, newest first', async () => {
      const mine = await service.create('narek', valid);
      const other = await service.create('ani', valid);
      await service.changeStatus('narek', mine.id, 'open');
      await service.changeStatus('ani', other.id, 'open');
      await service.addComment('agent-1', mine.id, {
        author: 'agent-1',
        body: 'hi',
      });

      const seqs = (await service.findAuditTrail(mine.id)).map((e) => e.seq);
      expect(seqs).toHaveLength(3); // created + status_changed + commented
      for (let i = 1; i < seqs.length; i++) {
        expect(seqs[i]).toBeLessThan(seqs[i - 1]);
      }
    });

    it('404s on the audit trail of an unknown ticket', async () => {
      await expect(service.findAuditTrail('tkt_missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  it('404s on unknown tickets', async () => {
    await expect(service.findById('tkt_missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  describe('pagination', () => {
    const createMany = async (count: number) => {
      const created: Ticket[] = [];
      for (let i = 0; i < count; i++) {
        created.push(
          await service.create('test', { ...valid, subject: `Ticket ${i}` }),
        );
      }
      return created;
    };

    it('defaults to a limit of 50 and offset of 0', async () => {
      await createMany(3);
      const page = await service.findAll();
      expect(page.meta).toEqual({
        limit: 50,
        offset: 0,
        total: 3,
        hasMore: false,
      });
      expect(page.items).toHaveLength(3);
    });

    it('applies limit and offset against a stable order', async () => {
      await createMany(5);
      const full = await service.findAll({ limit: '200' });
      expect(full.items).toHaveLength(5);

      const page = await service.findAll({ limit: '2', offset: '1' });
      expect(page.items.map((t) => t.id)).toEqual(
        full.items.slice(1, 3).map((t) => t.id),
      );
      expect(page.meta).toEqual({
        limit: 2,
        offset: 1,
        total: 5,
        hasMore: true,
      });
    });

    it('reports hasMore false on the last page', async () => {
      await createMany(5);
      const page = await service.findAll({ limit: '2', offset: '4' });
      expect(page.items).toHaveLength(1);
      expect(page.meta.hasMore).toBe(false);
    });

    it('caps limit at 200', async () => {
      await expect(service.findAll({ limit: '201' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a non-positive limit', async () => {
      await expect(service.findAll({ limit: '0' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a negative offset', async () => {
      await expect(service.findAll({ offset: '-1' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects non-integer limit/offset', async () => {
      await expect(service.findAll({ limit: 'abc' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findAll({ offset: '1.5' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('applies pagination after filtering', async () => {
      const created = await createMany(4);
      await service.changeStatus('test', created[1].id, 'open');
      await service.changeStatus('test', created[3].id, 'open');

      const allOpen = await service.findAll({ status: 'open', limit: '200' });
      expect(allOpen.items).toHaveLength(2);

      const page = await service.findAll({ status: 'open', limit: '1', offset: '1' });
      expect(page.items.map((t) => t.id)).toEqual([allOpen.items[1].id]);
      expect(page.meta.total).toBe(2);
      expect(page.meta.hasMore).toBe(false);
    });

    it('filters by customerEmail', async () => {
      const t = await service.create('test', {
        ...valid,
        customerEmail: 'other@example.am',
      });
      await createMany(3);

      const page = await service.findAll({ customerEmail: 'other@example.am' });
      expect(page.items.map((x) => x.id)).toEqual([t.id]);
      expect(page.meta.total).toBe(1);
    });
  });
});
