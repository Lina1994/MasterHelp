import { IsOptional, IsInt, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCellValueDto {
  cellId?: string; // if updating existing cell
  columnId: string;
  textValue?: string;
}

export class UpdateEntryDto {
  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateCellValueDto)
  cells?: UpdateCellValueDto[];
}
