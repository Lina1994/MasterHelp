import { IsArray, IsUUID } from 'class-validator';

export class AssociateSongDto {
  @IsArray()
  @IsUUID('all', { each: true })
  campaignIds: string[];
}
