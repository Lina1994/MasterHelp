import { PartialType } from '@nestjs/mapped-types';
import { CreateCardTemplateDto } from './create-card-template.dto';

/**
 * DTO for PATCH /card-templates/:id. Every field is optional.
 */
export class UpdateCardTemplateDto extends PartialType(CreateCardTemplateDto) {}
