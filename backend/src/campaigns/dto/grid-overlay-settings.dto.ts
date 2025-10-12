import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class GridOverlaySettingsDto {
  /** Enable or disable the grid overlay. */
  @IsBoolean()
  enabled!: boolean;

  /** Grid type: square or hex. */
  @IsIn(['square', 'hex'])
  type!: 'square' | 'hex';

  /** Cell size in CSS pixels (before projection transforms). */
  @IsNumber()
  @Min(6)
  cellSize!: number;

  /** Stroke color in CSS format (e.g., #RRGGBB). */
  @IsString()
  color!: string;

  /** Opacity 0..1 */
  @IsNumber()
  @Min(0)
  @Max(1)
  opacity!: number;

  /** Line width in CSS pixels. */
  @IsNumber()
  @Min(0.25)
  @Max(8)
  lineWidth!: number;
}
