import { IsNotEmpty, IsString, IsInt, IsOptional, IsIn } from 'class-validator';
import { CellType } from '../entities/shop-column.entity';

export class CreateColumnDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsIn(['text', 'image', 'video', 'audio', 'gif'])
  cellType: CellType;

  @IsOptional()
  @IsInt()
  order?: number;
}
