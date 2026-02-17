import { IsOptional, IsInt, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CellValueDto {
  columnId: string;
  textValue?: string;
  // file/url will be handled separately via multipart or specific endpoints
}

export class CreateEntryDto {
  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CellValueDto)
  cells?: CellValueDto[];
}
