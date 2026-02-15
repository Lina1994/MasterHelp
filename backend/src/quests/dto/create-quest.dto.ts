import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateQuestDto {
  @IsUUID()
  @IsNotEmpty()
  campaignId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsIn(['not_accepted', 'accepted', 'completed'])
  status?: 'not_accepted' | 'accepted' | 'completed';

  @IsOptional()
  @IsUUID()
  prerequisiteQuestId?: string | null;

  @IsOptional()
  @IsInt()
  order?: number;
}
