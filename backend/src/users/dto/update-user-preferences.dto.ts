import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * DTO used to update persisted user UI preferences.
 */
export class UpdateUserPreferencesDto {
  @IsOptional()
  @IsString()
  @IsIn(['es', 'en'])
  language?: string;

  @IsOptional()
  @IsString()
  theme?: string;

  @IsOptional()
  sidebarConfig?: string | null;

  @IsOptional()
  shortcutsConfig?: string | null;

  @IsOptional()
  mapsConfig?: string | null;
}