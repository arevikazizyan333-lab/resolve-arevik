import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TicketsRepository } from './tickets.repository';
import { AuditService } from '../audit/audit.service';
import { Ticket } from './ticket.entity';
import { TicketComment } from './ticket-comment.entity';
import { AuditEntry } from '../audit/audit-entry.entity';

// `@Get(':id/audit')` is declared after `@Get(':id')`. Only a routed request
// proves the wildcard does not swallow it, so this boots the real HTTP stack
// (still the real service + repository over in-memory SQLite, no mocks).
describe('TicketsController routing', () => {
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

  const post = (path: string, body: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-actor': 'narek' },
      body: JSON.stringify(body),
    });

  const createTicket = async (): Promise<string> => {
    const res = await post('/tickets', {
      subject: 'Cannot log in',
      description: 'Password reset email never arrives',
      customerEmail: 'ani@example.am',
      priority: 'high',
    });
    expect(res.status).toBe(201);
    return ((await res.json()) as { id: string }).id;
  };

  it('routes GET /tickets/:id/audit to the trail, not to GET /tickets/:id', async () => {
    const id = await createTicket();
    await post(`/tickets/${id}/status`, { to: 'open' });

    const res = await fetch(`${baseUrl}/tickets/${id}/audit`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as Array<{ action: string }>;
    expect(Array.isArray(body)).toBe(true); // a ticket object here would mean :id won
    expect(body.map((e) => e.action)).toEqual([
      'ticket.status_changed',
      'ticket.created',
    ]);
  });

  it('404s on the audit trail of an unknown ticket', async () => {
    const res = await fetch(`${baseUrl}/tickets/tkt_missing/audit`);
    expect(res.status).toBe(404);
  });
});
