import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketsController } from './tickets/tickets.controller';
import { TicketsService } from './tickets/tickets.service';
import { TicketsRepository } from './tickets/tickets.repository';
import { AuditService } from './audit/audit.service';
import { Ticket } from './tickets/ticket.entity';
import { TicketComment } from './tickets/ticket-comment.entity';
import { AuditEntry } from './audit/audit-entry.entity';

// Spec under test: specs/canned-responses-tags.md (CRT-1). None of the
// canned-response or ticket-tag routes exist yet — only today's real
// TicketsController/AuditService wiring is booted (in-memory SQLite, same
// pattern as tickets.controller.spec.ts). Every test below is expected to
// fail (RED) until that API surface is implemented.
describe('CRT-1: canned responses + ticket tags', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let baseUrl: string;

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
      controllers: [TicketsController],
      providers: [TicketsService, TicketsRepository, AuditService],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterEach(async () => {
    await app.close();
  });

  const post = (path: string, body: unknown, actor = 'api') =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-actor': actor },
      body: JSON.stringify(body),
    });

  const put = (path: string, body: unknown, actor = 'api') =>
    fetch(`${baseUrl}${path}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-actor': actor },
      body: JSON.stringify(body),
    });

  const get = (path: string) => fetch(`${baseUrl}${path}`);

  interface TicketResponse {
    id: string;
    subject: string;
    status: string;
    tags?: string[];
    comments: unknown[];
  }

  interface CommentResponse {
    id: string;
    author: string;
    body: string;
    internal: boolean;
  }

  interface CannedResponseResponse {
    id: string;
    title: string;
    body: string;
  }

  interface AuditEntryResponse {
    action: string;
    details: Record<string, unknown>;
  }

  const validTicket = {
    subject: 'Cannot log in',
    description: 'Password reset email never arrives',
    customerEmail: 'ani@example.am',
    priority: 'high',
  };

  const createTicket = async (): Promise<TicketResponse> => {
    const res = await post('/tickets', validTicket);
    expect(res.status).toBe(201);
    return (await res.json()) as TicketResponse;
  };

  const createCannedResponse = async (
    title: string,
    body: string,
  ): Promise<CannedResponseResponse> => {
    const res = await post('/canned-responses', { title, body });
    expect(res.status).toBe(201);
    return (await res.json()) as CannedResponseResponse;
  };

  describe('canned responses', () => {
    it('AC-1: POST /canned-responses creates a canned response, trimming title and body', async () => {
      const res = await post('/canned-responses', {
        title: '  Password reset  ',
        body: '  Please check your spam folder.  ',
      });
      expect(res.status).toBe(201);
      const created = (await res.json()) as CannedResponseResponse;
      expect(created.id).toEqual(expect.any(String));
      expect(created.title).toBe('Password reset');
      expect(created.body).toBe('Please check your spam folder.');
    });

    it.each([
      [{ title: undefined, body: 'x' }, 'title'],
      [{ title: '   ', body: 'x' }, 'title'],
      [{ title: 'x', body: undefined }, 'body'],
      [{ title: 'x', body: '   ' }, 'body'],
    ])(
      'AC-2: POST /canned-responses rejects %j naming %s',
      async (input, field) => {
        const res = await post('/canned-responses', input);
        expect(res.status).toBe(400);
        const body = (await res.json()) as { message: string };
        expect(body.message).toContain(field);
      },
    );

    it('AC-3: GET /canned-responses returns all canned responses, oldest first', async () => {
      const a = await createCannedResponse('Password reset', 'Reset instructions');
      const b = await createCannedResponse('Refund policy', 'Refund instructions');

      const res = await get('/canned-responses');
      expect(res.status).toBe(200);
      const list = (await res.json()) as CannedResponseResponse[];
      expect(list.map((c) => c.id)).toEqual([a.id, b.id]);
    });
  });

  describe('applying a canned response to a ticket', () => {
    it('AC-4: applying creates a comment whose body is the canned response body verbatim, ignoring other request fields', async () => {
      const ticket = await createTicket();
      const canned = await createCannedResponse(
        'Password reset',
        'Please check your spam folder for the reset link.',
      );

      const res = await post(
        `/tickets/${ticket.id}/canned-responses/${canned.id}/apply`,
        { body: 'this override must be ignored' },
      );
      expect(res.status).toBe(201);
      const comment = (await res.json()) as CommentResponse;
      expect(comment.body).toBe(canned.body);
    });

    it('AC-5: the applied comment defaults internal to false, and honors an explicit internal:true override', async () => {
      const ticket = await createTicket();
      const canned = await createCannedResponse('Password reset', 'Reset instructions');

      const defaultRes = await post(
        `/tickets/${ticket.id}/canned-responses/${canned.id}/apply`,
        {},
      );
      const defaulted = (await defaultRes.json()) as CommentResponse;
      expect(defaulted.internal).toBe(false);

      const overrideRes = await post(
        `/tickets/${ticket.id}/canned-responses/${canned.id}/apply`,
        { internal: true },
      );
      const overridden = (await overrideRes.json()) as CommentResponse;
      expect(overridden.internal).toBe(true);
    });

    it('AC-6: the applied comment author is set to the X-Actor header value', async () => {
      const ticket = await createTicket();
      const canned = await createCannedResponse('Password reset', 'Reset instructions');

      const res = await post(
        `/tickets/${ticket.id}/canned-responses/${canned.id}/apply`,
        {},
        'narek',
      );
      const comment = (await res.json()) as CommentResponse;
      expect(comment.author).toBe('narek');
    });

    it('AC-7: applying to an unknown ticket id returns 404', async () => {
      const canned = await createCannedResponse('Password reset', 'Reset instructions');
      const res = await post(
        `/tickets/tkt_missing/canned-responses/${canned.id}/apply`,
        {},
      );
      expect(res.status).toBe(404);
    });

    it('AC-7: applying an unknown cannedResponseId to a known ticket returns 404', async () => {
      const ticket = await createTicket();
      const res = await post(
        `/tickets/${ticket.id}/canned-responses/cr_missing/apply`,
        {},
      );
      expect(res.status).toBe(404);
    });

    it('AC-8: applying a canned response writes exactly one audit entry recording the canned response and comment', async () => {
      const ticket = await createTicket();
      const canned = await createCannedResponse('Password reset', 'Reset instructions');

      const before = (await (
        await get(`/tickets/${ticket.id}/audit`)
      ).json()) as AuditEntryResponse[];

      const applyRes = await post(
        `/tickets/${ticket.id}/canned-responses/${canned.id}/apply`,
        {},
      );
      const comment = (await applyRes.json()) as CommentResponse;

      const after = (await (
        await get(`/tickets/${ticket.id}/audit`)
      ).json()) as AuditEntryResponse[];

      expect(after.length).toBe(before.length + 1);
      const newEntry = after.find(
        (e) => !before.some((b) => b.action === e.action && JSON.stringify(b.details) === JSON.stringify(e.details)),
      );
      expect(JSON.stringify(newEntry?.details)).toContain(canned.id);
      expect(JSON.stringify(newEntry?.details)).toContain(comment.id);
    });

    it('INV: applying a canned response never mutates the canned response itself', async () => {
      const ticket = await createTicket();
      const canned = await createCannedResponse('Password reset', 'Reset instructions');

      await post(`/tickets/${ticket.id}/canned-responses/${canned.id}/apply`, {});

      const list = (await (await get('/canned-responses')).json()) as CannedResponseResponse[];
      const stillThere = list.find((c) => c.id === canned.id);
      expect(stillThere).toEqual(canned);
    });

    it('INV: applying a canned response is not idempotent — applying it twice creates two independent comments', async () => {
      const ticket = await createTicket();
      const canned = await createCannedResponse('Password reset', 'Reset instructions');

      const first = await post(
        `/tickets/${ticket.id}/canned-responses/${canned.id}/apply`,
        {},
      );
      const second = await post(
        `/tickets/${ticket.id}/canned-responses/${canned.id}/apply`,
        {},
      );
      const firstComment = (await first.json()) as CommentResponse;
      const secondComment = (await second.json()) as CommentResponse;

      expect(firstComment.id).not.toBe(secondComment.id);

      const fetched = (await (await get(`/tickets/${ticket.id}`)).json()) as {
        comments: CommentResponse[];
      };
      expect(fetched.comments).toHaveLength(2);
      expect(fetched.comments.map((c) => c.id).sort()).toEqual(
        [firstComment.id, secondComment.id].sort(),
      );
    });
  });

  describe('ticket tags', () => {
    it("AC-9: a ticket's tags default to [] at creation", async () => {
      const ticket = await createTicket();
      expect(ticket.tags).toEqual([]);
    });

    it('AC-10: PUT /tickets/:id/tags trims, lowercases, and deduplicates tags', async () => {
      const ticket = await createTicket();
      const res = await put(`/tickets/${ticket.id}/tags`, {
        tags: [' VIP ', 'vip', 'Billing'],
      });
      expect(res.status).toBe(200);
      const updated = (await res.json()) as TicketResponse;
      expect([...(updated.tags ?? [])].sort()).toEqual(['billing', 'vip']);
    });

    it('AC-10: PUT /tickets/:id/tags accepts non-blank tags containing spaces/punctuation', async () => {
      const ticket = await createTicket();
      const res = await put(`/tickets/${ticket.id}/tags`, {
        tags: ['needs follow-up!'],
      });
      expect(res.status).toBe(200);
      const updated = (await res.json()) as TicketResponse;
      expect(updated.tags).toEqual(['needs follow-up!']);
    });

    it('AC-11: PUT /tickets/:id/tags with tags: [] clears the tag set', async () => {
      const ticket = await createTicket();
      await put(`/tickets/${ticket.id}/tags`, { tags: ['vip'] });

      const res = await put(`/tickets/${ticket.id}/tags`, { tags: [] });
      expect(res.status).toBe(200);
      const updated = (await res.json()) as TicketResponse;
      expect(updated.tags).toEqual([]);
    });

    it.each([
      ['missing', undefined],
      ['null', null],
      ['a string', 'vip'],
      ['a number', 123],
      ['an array of non-strings', [1, 2]],
    ])('AC-12: PUT /tickets/:id/tags rejects tags that is %s, naming tags', async (_label, tags) => {
      const ticket = await createTicket();
      const res = await put(`/tickets/${ticket.id}/tags`, { tags });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { message: string };
      expect(body.message).toContain('tags');
    });

    it('AC-13: PUT /tickets/:id/tags rejects a blank/whitespace-only entry, naming tags', async () => {
      const ticket = await createTicket();
      const res = await put(`/tickets/${ticket.id}/tags`, {
        tags: ['vip', '   '],
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { message: string };
      expect(body.message).toContain('tags');
    });

    it('AC-14: PUT /tickets/:id/tags rejects more than 10 unique tags, naming tags and the max of 10', async () => {
      const ticket = await createTicket();
      const tags = Array.from({ length: 11 }, (_, i) => `tag${i}`);
      const res = await put(`/tickets/${ticket.id}/tags`, { tags });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { message: string };
      expect(body.message).toContain('tags');
      expect(body.message).toContain('10');
    });

    it('AC-14: PUT /tickets/:id/tags accepts exactly 10 unique tags', async () => {
      const ticket = await createTicket();
      const tags = Array.from({ length: 10 }, (_, i) => `tag${i}`);
      const res = await put(`/tickets/${ticket.id}/tags`, { tags });
      expect(res.status).toBe(200);
    });

    it('AC-15: PUT /tickets/:id/tags on an unknown ticket id returns 404', async () => {
      const res = await put('/tickets/tkt_missing/tags', { tags: ['vip'] });
      expect(res.status).toBe(404);
    });

    it('AC-16: PUT /tickets/:id/tags writes exactly one audit entry recording the previous and new tag sets', async () => {
      const ticket = await createTicket();
      const before = (await (
        await get(`/tickets/${ticket.id}/audit`)
      ).json()) as AuditEntryResponse[];

      await put(`/tickets/${ticket.id}/tags`, { tags: ['vip'] });

      const after = (await (
        await get(`/tickets/${ticket.id}/audit`)
      ).json()) as AuditEntryResponse[];

      expect(after.length).toBe(before.length + 1);
      const newEntry = after.find(
        (e) => !before.some((b) => b.action === e.action && JSON.stringify(b.details) === JSON.stringify(e.details)),
      );
      expect(JSON.stringify(newEntry?.details)).toContain('vip');
    });

    it('AC-17: PUT /tickets/:id/tags returns 200 with the full updated ticket', async () => {
      const ticket = await createTicket();
      const res = await put(`/tickets/${ticket.id}/tags`, { tags: ['vip'] });
      expect(res.status).toBe(200);
      const updated = (await res.json()) as TicketResponse;
      expect(updated.id).toBe(ticket.id);
      expect(updated.subject).toBe(ticket.subject);
      expect(updated.tags).toEqual(['vip']);
    });

    it('AC-18: tags appear on every ticket representation returned by the API', async () => {
      const created = await createTicket();
      expect(Array.isArray(created.tags)).toBe(true);

      const fetched = (await (
        await get(`/tickets/${created.id}`)
      ).json()) as TicketResponse;
      expect(Array.isArray(fetched.tags)).toBe(true);

      const listBody = (await (await get('/tickets')).json()) as {
        items: TicketResponse[];
      };
      expect(listBody.items.length).toBeGreaterThan(0);
      expect(Array.isArray(listBody.items[0].tags)).toBe(true);

      const statusRes = await post(`/tickets/${created.id}/status`, {
        to: 'open',
      });
      const afterStatus = (await statusRes.json()) as TicketResponse;
      expect(Array.isArray(afterStatus.tags)).toBe(true);

      const tagsRes = await put(`/tickets/${created.id}/tags`, { tags: [] });
      const afterTags = (await tagsRes.json()) as TicketResponse;
      expect(Array.isArray(afterTags.tags)).toBe(true);
    });
  });

  describe('filtering by tag', () => {
    const setupTaggedTickets = async (): Promise<{
      tagged: TicketResponse;
      untagged: TicketResponse;
    }> => {
      const tagged = await createTicket();
      const untagged = await createTicket();
      const putRes = await put(`/tickets/${tagged.id}/tags`, {
        tags: ['vip'],
      });
      expect(putRes.status).toBe(200);
      return { tagged, untagged };
    };

    it('AC-19: GET /tickets?tag=vip returns only tickets whose tag set contains vip', async () => {
      const { tagged, untagged } = await setupTaggedTickets();
      const res = await get('/tickets?tag=vip');
      const body = (await res.json()) as { items: TicketResponse[] };
      expect(body.items.map((t) => t.id)).toEqual([tagged.id]);
      expect(body.items.map((t) => t.id)).not.toContain(untagged.id);
    });

    it('AC-19: GET /tickets?tag=vi does not substring-match the tag vip', async () => {
      const { tagged } = await setupTaggedTickets();
      const res = await get('/tickets?tag=vi');
      const body = (await res.json()) as { items: TicketResponse[] };
      expect(body.items.map((t) => t.id)).not.toContain(tagged.id);
    });

    it('AC-20: GET /tickets?tag=VIP matches the lowercase-stored tag vip', async () => {
      const { tagged } = await setupTaggedTickets();
      const res = await get('/tickets?tag=VIP');
      const body = (await res.json()) as { items: TicketResponse[] };
      expect(body.items.map((t) => t.id)).toContain(tagged.id);
    });

    it('AC-21: GET /tickets?tag=%20vip%20 matches the tag vip after trimming', async () => {
      const { tagged } = await setupTaggedTickets();
      const res = await get('/tickets?tag=%20vip%20');
      const body = (await res.json()) as { items: TicketResponse[] };
      expect(body.items.map((t) => t.id)).toContain(tagged.id);
    });

    it('AC-22: GET /tickets?tag= (empty string) behaves like no tag filter', async () => {
      const { tagged, untagged } = await setupTaggedTickets();
      const res = await get('/tickets?tag=');
      const body = (await res.json()) as { items: TicketResponse[] };
      const ids = body.items.map((t) => t.id);
      expect(ids).toEqual(expect.arrayContaining([tagged.id, untagged.id]));
    });

    it('AC-23: GET /tickets?tag= combines with status as an AND filter', async () => {
      const { tagged } = await setupTaggedTickets();
      await post(`/tickets/${tagged.id}/status`, { to: 'open' });

      const matches = (await (
        await get('/tickets?tag=vip&status=open')
      ).json()) as { items: TicketResponse[] };
      expect(matches.items.map((t) => t.id)).toEqual([tagged.id]);

      const noMatches = (await (
        await get('/tickets?tag=vip&status=new')
      ).json()) as { items: TicketResponse[] };
      expect(noMatches.items).toEqual([]);
    });

    it('AC-24: GET /tickets?tag=doesnotexist returns an empty result set (200)', async () => {
      await setupTaggedTickets();
      const res = await get('/tickets?tag=doesnotexist');
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: TicketResponse[] };
      expect(body.items).toEqual([]);
    });

    it('AC-25: pagination meta.total reflects the tag-filtered count, not the unfiltered total', async () => {
      await setupTaggedTickets();
      const res = await get('/tickets?tag=vip');
      const body = (await res.json()) as { meta: { total: number } };
      expect(body.meta.total).toBe(1);
    });
  });
});