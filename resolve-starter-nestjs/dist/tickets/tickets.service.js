"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketsService = exports.ALLOWED_TRANSITIONS = void 0;
const common_1 = require("@nestjs/common");
const tickets_repository_1 = require("./tickets.repository");
const audit_service_1 = require("../audit/audit.service");
const ticket_entity_1 = require("./ticket.entity");
const ticket_comment_entity_1 = require("./ticket-comment.entity");
const ids_1 = require("../common/ids");
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
exports.ALLOWED_TRANSITIONS = {
    new: ['open'],
    open: ['in_progress'],
    in_progress: ['waiting_customer', 'resolved'],
    waiting_customer: ['in_progress'],
    resolved: ['closed'],
    closed: [],
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let TicketsService = class TicketsService {
    constructor(tickets, audit) {
        this.tickets = tickets;
        this.audit = audit;
    }
    async create(actor, input) {
        if (!input.subject?.trim()) {
            throw new common_1.BadRequestException('subject must be a non-empty string');
        }
        if (!input.description?.trim()) {
            throw new common_1.BadRequestException('description must be a non-empty string');
        }
        if (!input.customerEmail || !EMAIL_RE.test(input.customerEmail)) {
            throw new common_1.BadRequestException('customerEmail must be a valid email address');
        }
        if (!PRIORITIES.includes(input.priority)) {
            throw new common_1.BadRequestException(`priority must be one of: ${PRIORITIES.join(', ')}`);
        }
        const now = new Date().toISOString();
        const ticket = new ticket_entity_1.Ticket();
        ticket.id = (0, ids_1.newId)('tkt');
        ticket.subject = input.subject.trim();
        ticket.description = input.description.trim();
        ticket.customerEmail = input.customerEmail;
        ticket.priority = input.priority;
        ticket.status = 'new';
        ticket.comments = [];
        ticket.createdAt = now;
        ticket.updatedAt = now;
        ticket.resolvedAt = null;
        await this.tickets.save(ticket);
        await this.audit.record(actor, 'ticket.created', ticket.id, {
            subject: ticket.subject,
            priority: ticket.priority,
        });
        return ticket;
    }
    async changeStatus(actor, id, to) {
        const ticket = await this.findById(id);
        const allowed = exports.ALLOWED_TRANSITIONS[ticket.status];
        if (!to || !allowed.includes(to)) {
            throw new common_1.BadRequestException(`cannot move ticket from '${ticket.status}' to '${to}'; allowed: ${allowed.length ? allowed.join(', ') : '(none — terminal state)'}`);
        }
        const from = ticket.status;
        ticket.status = to;
        if (ticket.status === 'resolved') {
            ticket.resolvedAt = new Date().toISOString();
        }
        await this.tickets.save(ticket);
        await this.audit.record(actor, 'ticket.status_changed', ticket.id, {
            from,
            to,
        });
        return ticket;
    }
    async addComment(actor, id, input) {
        const ticket = await this.findById(id);
        if (!input.author?.trim()) {
            throw new common_1.BadRequestException('author must be a non-empty string');
        }
        if (!input.body?.trim()) {
            throw new common_1.BadRequestException('body must be a non-empty string');
        }
        const comment = new ticket_comment_entity_1.TicketComment();
        comment.id = (0, ids_1.newId)('cmt');
        comment.author = input.author.trim();
        comment.body = input.body.trim();
        comment.internal = input.internal === true;
        comment.at = new Date().toISOString();
        ticket.comments.push(comment);
        await this.tickets.save(ticket);
        await this.audit.record(actor, 'ticket.commented', ticket.id, {
            commentId: comment.id,
            internal: comment.internal,
        });
        return comment;
    }
    async findAll(filter = {}) {
        return this.tickets.findAll(filter);
    }
    async findById(id) {
        const ticket = await this.tickets.findById(id);
        if (!ticket)
            throw new common_1.NotFoundException(`ticket ${id} not found`);
        return ticket;
    }
};
exports.TicketsService = TicketsService;
exports.TicketsService = TicketsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tickets_repository_1.TicketsRepository,
        audit_service_1.AuditService])
], TicketsService);
//# sourceMappingURL=tickets.service.js.map