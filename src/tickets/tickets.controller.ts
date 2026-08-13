import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketPriority, TicketStatus } from './ticket.entity';

// No class-level prefix: canned-response routes live at the top level
// (`/canned-responses`, not `/tickets/canned-responses`), alongside the
// ticket routes, so every path below is spelled out in full.
@Controller()
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post('tickets')
  create(@Body() body: Record<string, unknown>, @Headers('x-actor') actor = 'api') {
    return this.ticketsService.create(actor, body as never);
  }

  @Get('tickets')
  findAll(
    @Query('status') status?: TicketStatus,
    @Query('priority') priority?: TicketPriority,
    @Query('customerEmail') customerEmail?: string,
    @Query('tag') tag?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.ticketsService.findAll({
      status,
      priority,
      customerEmail,
      tag,
      limit,
      offset,
    });
  }

  @Get('tickets/:id')
  findOne(@Param('id') id: string) {
    return this.ticketsService.findById(id);
  }

  @Get('tickets/:id/audit')
  findAuditTrail(@Param('id') id: string) {
    return this.ticketsService.findAuditTrail(id);
  }

  @Post('tickets/:id/status')
  changeStatus(
    @Param('id') id: string,
    @Body() body: { to?: string },
    @Headers('x-actor') actor = 'api',
  ) {
    return this.ticketsService.changeStatus(actor, id, body?.to);
  }

  @Post('tickets/:id/comments')
  addComment(
    @Param('id') id: string,
    @Body() body: { author?: string; body?: string; internal?: boolean },
    @Headers('x-actor') actor = 'api',
  ) {
    return this.ticketsService.addComment(actor, id, body ?? {});
  }

  @Put('tickets/:id/tags')
  setTags(
    @Param('id') id: string,
    @Body() body: { tags?: unknown },
    @Headers('x-actor') actor = 'api',
  ) {
    return this.ticketsService.setTags(actor, id, body?.tags);
  }

  @Post('tickets/:id/canned-responses/:cannedResponseId/apply')
  applyCannedResponse(
    @Param('id') id: string,
    @Param('cannedResponseId') cannedResponseId: string,
    @Body() body: { internal?: boolean },
    @Headers('x-actor') actor = 'api',
  ) {
    return this.ticketsService.applyCannedResponse(
      actor,
      id,
      cannedResponseId,
      body ?? {},
    );
  }

  @Post('canned-responses')
  createCannedResponse(
    @Body() body: { title?: string; body?: string },
    @Headers('x-actor') actor = 'api',
  ) {
    return this.ticketsService.createCannedResponse(actor, body ?? {});
  }

  @Get('canned-responses')
  findAllCannedResponses() {
    return this.ticketsService.findAllCannedResponses();
  }
}
