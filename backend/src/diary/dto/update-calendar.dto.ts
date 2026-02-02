import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';

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
