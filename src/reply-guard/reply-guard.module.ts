import { Module } from '@nestjs/common';
import { TicketsModule } from '../tickets/tickets.module';
import { ReplyGuardController } from './reply-guard.controller';
import { ReplyGuardService } from './reply-guard.service';

@Module({
  imports: [TicketsModule],
  controllers: [ReplyGuardController],
  providers: [ReplyGuardService],
})
export class ReplyGuardModule {}
