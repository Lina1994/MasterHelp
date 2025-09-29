import { IsNotEmpty, IsString, IsEmail, ValidateIf } from 'class-validator';

export class InvitePlayerDto {
  @IsNotEmpty()
  @IsString()
  campaignId: string;

  @ValidateIf(o => o.email !== undefined && o.email !== '')
  @IsEmail({}, { message: 'email must be a valid email' })
  email?: string;

  @ValidateIf(o => o.username !== undefined && o.username !== '')
  @IsString({ message: 'username must be a string' })
  username?: string;
}
