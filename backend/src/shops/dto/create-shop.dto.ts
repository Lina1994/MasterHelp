import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateShopDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsString()
  campaignId: string;
}
