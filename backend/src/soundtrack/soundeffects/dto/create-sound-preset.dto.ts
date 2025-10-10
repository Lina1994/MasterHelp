import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SoundPresetItemInputDto {
  @ApiProperty()
  @IsString()
  soundEffectId: string;

  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  volume: number; // 0..1

  @ApiProperty({ enum: ['continuous', 'fixed', 'random'] as const })
  @IsIn(['continuous', 'fixed', 'random'])
  loopMode: 'continuous' | 'fixed' | 'random';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  waitMs?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  randomMinMs?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  randomMaxMs?: number;

  // Modificadores
  @ApiProperty({ required: false })
  @IsOptional()
  echoEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  echoDelayMs?: number;

  @ApiProperty({ required: false, description: '0..1' })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  echoFeedback?: number;

  @ApiProperty({ required: false, description: 'Semitonos: negativo grave, positivo agudo' })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-24)
  @Max(24)
  pitchSemitones?: number;
}

export class CreateSoundPresetDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  campaignId: string;

  @ApiProperty({ type: [SoundPresetItemInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SoundPresetItemInputDto)
  items: SoundPresetItemInputDto[];
}
