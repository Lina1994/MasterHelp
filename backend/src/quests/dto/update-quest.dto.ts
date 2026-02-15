import { IsIn, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateQuestDto {
  @IsOptional()
  @IsString()
  title?: string;

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
