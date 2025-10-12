import { PartialType } from '@nestjs/mapped-types';
import { CreateCharacterDto } from './create-character.dto';
import { IsNumber, IsOptional, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateCharacterDto extends PartialType(CreateCharacterDto) {
	/**
	 * Override to allow explicit null (unassign) when updating.
	 * Keeps undefined = not provided (no change), null = clear assignment, number = assign to user id.
	 */
	@IsOptional()
		@ValidateIf((_, value) => value !== null)
		@Transform(({ value }) => (value === '' ? null : value === null ? null : value === undefined ? undefined : Number(value)))
		@IsNumber()
	ownerPlayerId?: number | null;
}
