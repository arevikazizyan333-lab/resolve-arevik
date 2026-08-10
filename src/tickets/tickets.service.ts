import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TicketsRepository } from './tickets.repository';
import { AuditService } from '../audit/audit.service';
import { AuditEntry } from '../audit/audit-entry.entity';
import { Ticket, TicketPriority, TicketStatus } from './ticket.entity';
import { TicketComment } from './ticket-comment.entity';
import { newId } from '../common/ids';
import { Paginated, parseOffsetPage, paginate } from '../common/pagination';
import { CannedResponse } from './canned-response.model';

const PRIORITIES: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];
const MAX_TAGS = 10;

export const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  new: ['open'],
  open: ['in_progress'],
  in_progress: ['waiting_customer', 'resolved'],
  waiting_customer: ['in_progress'],
  resolved: ['closed', 'open'],
  closed: [],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class TicketsService {
  constructor(
    private readonly tickets: TicketsRepository,
    private readonly audit: AuditService,
  ) {}

  async create(
    actor: string,
    input: {
      subject?: string;
      description?: string;
      customerEmail?: string;
      priority?: string;
    },
  ): Promise<Ticket> {
    if (!input.subject?.trim()) {
      throw new BadRequestException('subject must be a non-empty string');
    }
    if (!input.description?.trim()) {
      throw new BadRequestException('description must be a non-empty string');
    }
    if (!input.customerEmail || !EMAIL_RE.test(input.customerEmail)) {
      throw new BadRequestException('customerEmail must be a valid email address');
    }
    if (!PRIORITIES.includes(input.priority as TicketPriority)) {
      throw new BadRequestException(
        `priority must be one of: ${PRIORITIES.join(', ')}`,
      );
    }
    const now = new Date().toISOString();
    const ticket = new Ticket();
    ticket.id = newId('tkt');
    ticket.subject = input.subject.trim();
    ticket.description = input.description.trim();
    ticket.customerEmail = input.customerEmail;
    ticket.priority = input.priority as TicketPriority;
    ticket.status = 'new';
    ticket.tags = [];
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

  async changeStatus(actor: string, id: string, to?: string): Promise<Ticket> {
    const ticket = await this.findById(id);
    const allowed = ALLOWED_TRANSITIONS[ticket.status];
    if (!to || !allowed.includes(to as TicketStatus)) {
      throw new BadRequestException(
        `cannot move ticket from '${ticket.status}' to '${to}'; allowed: ${
          allowed.length ? allowed.join(', ') : '(none — terminal state)'
        }`,
      );
    }
    const from = ticket.status;
    ticket.status = to as TicketStatus;
    if (ticket.status === 'resolved') {
      ticket.resolvedAt = new Date().toISOString();
    } else if (from === 'resolved' && ticket.status === 'open') {
      // reopened: no longer resolved until it is resolved again
      ticket.resolvedAt = null;
    }
    await this.tickets.save(ticket);
    await this.audit.record(actor, 'ticket.status_changed', ticket.id, {
      from,
      to,
    });
    return ticket;
  }

  async addComment(
    actor: string,
    id: string,
    input: { author?: string; body?: string; internal?: boolean },
  ): Promise<TicketComment> {
    const ticket = await this.findById(id);
    if (!input.author?.trim()) {
      throw new BadRequestException('author must be a non-empty string');
    }
    if (!input.body?.trim()) {
      throw new BadRequestException('body must be a non-empty string');
    }
    const comment = new TicketComment();
    comment.id = newId('cmt');
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

  async findAll(
    filter: {
      status?: TicketStatus;
      priority?: TicketPriority;
      customerEmail?: string;
      tag?: string;
      limit?: string;
      offset?: string;
    } = {},
  ): Promise<Paginated<Ticket>> {
    const page = parseOffsetPage(filter);
    const tag = filter.tag?.trim().toLowerCase() || undefined;
    const { tickets, total } = await this.tickets.findAll(
      {
        status: filter.status,
        priority: filter.priority,
        customerEmail: filter.customerEmail,
        tag,
      },
      page,
    );
    return paginate(tickets, total, page);
  }

  async setTags(actor: string, id: string, tagsInput: unknown): Promise<Ticket> {
    const ticket = await this.findById(id);

    if (!Array.isArray(tagsInput) || tagsInput.some((t) => typeof t !== 'string')) {
      throw new BadRequestException('tags must be an array of strings');
    }
    const trimmed = tagsInput.map((t) => t.trim());
    if (trimmed.some((t) => t.length === 0)) {
      throw new BadRequestException('tags must not contain blank entries');
    }
    const unique = Array.from(new Set(trimmed.map((t) => t.toLowerCase())));
    if (unique.length > MAX_TAGS) {
      throw new BadRequestException(
        `tags must contain at most ${MAX_TAGS} unique tags`,
      );
    }

    const previousTags = ticket.tags;
    ticket.tags = unique;
    await this.tickets.save(ticket);
    await this.audit.record(actor, 'ticket.tags_updated', ticket.id, {
      previousTags,
      newTags: unique,
    });
    return ticket;
  }

  async createCannedResponse(
    actor: string,
    input: { title?: string; body?: string },
  ): Promise<CannedResponse> {
    if (!input.title?.trim()) {
      throw new BadRequestException('title must be a non-empty string');
    }
    if (!input.body?.trim()) {
      throw new BadRequestException('body must be a non-empty string');
    }
    const cannedResponse: CannedResponse = {
      id: newId('cr'),
      title: input.title.trim(),
      body: input.body.trim(),
      createdAt: new Date().toISOString(),
    };
    this.tickets.saveCannedResponse(cannedResponse);
    return cannedResponse;
  }

  async findAllCannedResponses(): Promise<CannedResponse[]> {
    return this.tickets.findAllCannedResponses();
  }

  async applyCannedResponse(
    actor: string,
    ticketId: string,
    cannedResponseId: string,
    input: { internal?: boolean },
  ): Promise<TicketComment> {
    const ticket = await this.findById(ticketId);
    const cannedResponse = this.tickets.findCannedResponseById(cannedResponseId);
    if (!cannedResponse) {
      throw new NotFoundException(
        `canned response ${cannedResponseId} not found`,
      );
    }

    const comment = new TicketComment();
    comment.id = newId('cmt');
    comment.author = actor;
    comment.body = cannedResponse.body;
    comment.internal = input?.internal === true;
    comment.at = new Date().toISOString();

    ticket.comments.push(comment);
    await this.tickets.save(ticket);
    await this.audit.record(actor, 'ticket.canned_response_applied', ticket.id, {
      cannedResponseId: cannedResponse.id,
      commentId: comment.id,
    });
    return comment;
  }

  async findById(id: string): Promise<Ticket> {
    const ticket = await this.tickets.findById(id);
    if (!ticket) throw new NotFoundException(`ticket ${id} not found`);
    return ticket;
  }

  // Newest first — deliberately the reverse of GET /audit, because a ticket's
  // detail view reads most-recent-first. Sorted on `seq` rather than reversing
  // whatever order AuditService.list happened to return, so this survives a
  // change to that default. Unpaginated, like GET /audit: one ticket's trail is
  // bounded by that ticket's own activity.
  async findAuditTrail(id: string): Promise<AuditEntry[]> {
    await this.findById(id); // 404s on unknown tickets, like GET /tickets/:id
    const entries = await this.audit.list(id);
    return [...entries].sort((a, b) => b.seq - a.seq);
  }
}
