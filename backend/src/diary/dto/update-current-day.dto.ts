import { IsInt, Min } from 'class-validator';

/**
 * Update the current day of the campaign.
 */
export class UpdateCurrentDayDto {
  @IsInt()
  @Min(0)
  monthIndex: number;

  @IsInt()
  @Min(1)
  dayIndex: number;
}
