import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketPriority, TicketStatus } from './ticket.entity';
import { OffsetPage } from '../common/pagination';
import { CannedResponse } from './canned-response.model';

@Injectable()
export class TicketsRepository {
  // No table backs this: see canned-response.model.ts for why it's in-memory.
  private readonly cannedResponses: CannedResponse[] = [];

  constructor(
    @InjectRepository(Ticket) private readonly repo: Repository<Ticket>,
  ) {}

  async findAll(
    filter: {
      status?: TicketStatus;
      priority?: TicketPriority;
      customerEmail?: string;
      tag?: string;
    } = {},
    page?: OffsetPage,
  ): Promise<{ tickets: Ticket[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (filter.status) where.status = filter.status;
    if (filter.priority) where.priority = filter.priority;
    if (filter.customerEmail) where.customerEmail = filter.customerEmail;

    if (filter.tag) {
      const tag = filter.tag;
      const all = await this.repo.find({
        where,
        order: { createdAt: 'ASC', id: 'ASC' },
      });
      const matching = all.filter((t) => t.tags?.includes(tag));
      matching.forEach((t) => this.sortComments(t));
      const offset = page?.offset ?? 0;
      const tickets =
        page?.limit !== undefined
          ? matching.slice(offset, offset + page.limit)
          : matching.slice(offset);
      return { tickets, total: matching.length };
    }

    const [tickets, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'ASC', id: 'ASC' },
      take: page?.limit,
      skip: page?.offset,
    });
    tickets.forEach((t) => this.sortComments(t));
    return { tickets, total };
  }

  async findById(id: string): Promise<Ticket | null> {
    const ticket = await this.repo.findOne({ where: { id } });
    if (ticket) this.sortComments(ticket);
    return ticket;
  }

  async save(ticket: Ticket): Promise<Ticket> {
    ticket.updatedAt = new Date().toISOString();
    const saved = await this.repo.save(ticket);
    this.sortComments(saved);
    return saved;
  }

  private sortComments(ticket: Ticket): void {
    ticket.comments?.sort((a, b) => a.seq - b.seq);
  }

  saveCannedResponse(cannedResponse: CannedResponse): CannedResponse {
    this.cannedResponses.push(cannedResponse);
    return cannedResponse;
  }

  findAllCannedResponses(): CannedResponse[] {
    return [...this.cannedResponses];
  }

  findCannedResponseById(id: string): CannedResponse | undefined {
    return this.cannedResponses.find((c) => c.id === id);
  }
}
