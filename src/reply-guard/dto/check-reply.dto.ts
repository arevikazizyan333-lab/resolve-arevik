import { IsNotEmpty, IsString } from 'class-validator';

export class CheckReplyDto {
  @IsString()
  @IsNotEmpty()
  ticketId: string;

  @IsString()
  @IsNotEmpty()
  draft: string;
}
