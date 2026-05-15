import { PartialType } from '@nestjs/mapped-types';
import { CreateSceneDto } from './create-scene.dto';

/**
 * DTO for partially updating an owned scene.
 */
export class UpdateSceneDto extends PartialType(CreateSceneDto) {}