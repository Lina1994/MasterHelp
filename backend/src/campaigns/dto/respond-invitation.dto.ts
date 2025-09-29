import { IsNotEmpty, IsString } from 'class-validator';

export class RespondInvitationDto {
  @IsNotEmpty()
  @IsString()
  invitationId: string;

  @IsNotEmpty()
  @IsString()
  response: 'accept' | 'decline';
}
