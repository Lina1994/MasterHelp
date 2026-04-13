import { PartialType } from '@nestjs/swagger';
import { CreateShortcutDto } from './create-shortcut.dto';

/**
 * DTO for updating a shortcut definition.
 */
export class UpdateShortcutDto extends PartialType(CreateShortcutDto) {}