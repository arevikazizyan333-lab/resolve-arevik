import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketPriority, TicketStatus } from './ticket.entity';
import { OffsetPage } from '../common/pagination';

@Injectable()
export class TicketsRepository {
  constructor(
    @InjectRepository(Ticket) private readonly repo: Repository<Ticket>,
  ) {}

  async findAll(
    filter: { status?: TicketStatus; priority?: TicketPriority } = {},
    page?: OffsetPage,
  ): Promise<{ tickets: Ticket[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (filter.status) where.status = filter.status;
    if (filter.priority) where.priority = filter.priority;
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
}
