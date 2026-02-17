import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UploadCellMediaDto {
  @IsNotEmpty()
  @IsString()
  columnId: string;

  @IsOptional()
  @IsString()
  url?: string; // if uploading from URL instead of file
}
