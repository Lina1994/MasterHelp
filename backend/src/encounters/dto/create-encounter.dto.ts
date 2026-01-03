/** DTO para crear encuentros. */
import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { EncounterParticipantDto } from './encounter-participant.dto';

export class CreateEncounterDto {
  @IsString()
  @Length(1, 200)
  name: string;

  @IsString()
  @IsIn(['Fácil', 'Medio', 'Difícil', 'Mortal'])
  difficulty: 'Fácil' | 'Medio' | 'Difícil' | 'Mortal';

  @IsOptional()
  @IsString()
  @Length(0, 500)
  musicLabel?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  musicSongId?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => EncounterParticipantDto)
  participants?: EncounterParticipantDto[];
}
