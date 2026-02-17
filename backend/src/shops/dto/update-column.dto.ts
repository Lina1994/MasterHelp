import { IsOptional, IsString, IsInt, IsIn } from 'class-validator';
import { CellType } from '../entities/shop-column.entity';

export class UpdateColumnDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['text', 'image', 'video', 'audio', 'gif'])
  cellType?: CellType;

  @IsOptional()
  @IsInt()
  order?: number;
}
