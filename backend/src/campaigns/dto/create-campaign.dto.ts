import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateCampaignDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}
