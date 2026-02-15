import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Matches, MaxLength, Min, ValidateNested } from 'class-validator';

export class DiaryMonthConfigDto {
  /** Display name of the month. */
  @IsString()
  name: string;

  /** Number of days in this month. */
  @IsInt()
  @Min(1)
  days: number;
}

export class DiaryWeekdayConfigDto {
  /** Display name of the weekday. */
  @IsString()
  name: string;
}

/**
 * Updates the calendar config for a campaign.
 */
export class UpdateDiaryCalendarDto {
  @IsInt()
  currentYear: number;

  @IsInt()
  @Min(0)
  currentMonthIndex: number;

  @IsInt()
  @Min(1)
  currentDayIndex: number;

  /**
   * Optional template for year display.
   * Must contain `{year}` placeholder.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/\{year\}/, { message: 'yearLabelTemplate must include {year}' })
  yearLabelTemplate?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DiaryMonthConfigDto)
  months: DiaryMonthConfigDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DiaryWeekdayConfigDto)
  weekDays: DiaryWeekdayConfigDto[];
}
