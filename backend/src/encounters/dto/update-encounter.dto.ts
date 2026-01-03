/** DTO para actualizar encuentros. Todos los campos son opcionales. */
import { PartialType } from '@nestjs/mapped-types';
import { CreateEncounterDto } from './create-encounter.dto';

export class UpdateEncounterDto extends PartialType(CreateEncounterDto) {}
