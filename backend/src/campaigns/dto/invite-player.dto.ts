import { IsNotEmpty, IsString, IsOptional, IsEmail } from 'class-validator';

export class InvitePlayerDto {
  @IsNotEmpty()
  @IsString()
  campaignId: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  username?: string;
}
