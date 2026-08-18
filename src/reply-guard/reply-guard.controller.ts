import { Body, Controller, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { ReplyGuardService } from './reply-guard.service';
import { CheckReplyDto } from './dto/check-reply.dto';
import { CheckReplyResponse } from './reply-guard.types';

@Controller('replies')
export class ReplyGuardController {
  constructor(private readonly replyGuard: ReplyGuardService) {}

  @Post('check')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  check(@Body() dto: CheckReplyDto): Promise<CheckReplyResponse> {
    return this.replyGuard.check(dto.ticketId, dto.draft);
  }
}
