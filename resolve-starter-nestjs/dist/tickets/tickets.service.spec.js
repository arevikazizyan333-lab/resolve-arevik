"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const common_1 = require("@nestjs/common");
const tickets_service_1 = require("./tickets.service");
const tickets_repository_1 = require("./tickets.repository");
const audit_service_1 = require("../audit/audit.service");
const ticket_entity_1 = require("./ticket.entity");
const ticket_comment_entity_1 = require("./ticket-comment.entity");
const audit_entry_entity_1 = require("../audit/audit-entry.entity");
describe('TicketsService', () => {
    let moduleRef;
    let service;
    let audit;
    beforeEach(async () => {
        moduleRef = await testing_1.Test.createTestingModule({
            imports: [
                typeorm_1.TypeOrmModule.forRoot({
                    type: 'better-sqlite3',
                    database: ':memory:',
                    dropSchema: true,
                    synchronize: true,
                    entities: [ticket_entity_1.Ticket, ticket_comment_entity_1.TicketComment, audit_entry_entity_1.AuditEntry],
                }),
                typeorm_1.TypeOrmModule.forFeature([ticket_entity_1.Ticket, ticket_comment_entity_1.TicketComment, audit_entry_entity_1.AuditEntry]),
            ],
            providers: [tickets_service_1.TicketsService, tickets_repository_1.TicketsRepository, audit_service_1.AuditService],
        }).compile();
        service = moduleRef.get(tickets_service_1.TicketsService);
        audit = moduleRef.get(audit_service_1.AuditService);
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
            await expect(service.create('test', input)).rejects.toThrow(expect.objectContaining({ message: expect.stringContaining(field) }));
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
            await expect(service.changeStatus('test', t.id, 'resolved')).rejects.toThrow(common_1.BadRequestException);
        });
        it('rejects reopening a closed ticket', async () => {
            const t = await service.create('test', valid);
            for (const to of ['open', 'in_progress', 'resolved', 'closed']) {
                await service.changeStatus('test', t.id, to);
            }
            await expect(service.changeStatus('test', t.id, 'open')).rejects.toThrow(common_1.BadRequestException);
        });
        it('names the allowed next states in the error', async () => {
            const t = await service.create('test', valid);
            await expect(service.changeStatus('test', t.id, 'closed')).rejects.toThrow(expect.objectContaining({ message: expect.stringContaining('open') }));
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
            await expect(service.addComment('x', t.id, { author: 'x', body: ' ' })).rejects.toThrow(common_1.BadRequestException);
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
    });
    it('404s on unknown tickets', async () => {
        await expect(service.findById('tkt_missing')).rejects.toThrow(common_1.NotFoundException);
    });
});
//# sourceMappingURL=tickets.service.spec.js.map