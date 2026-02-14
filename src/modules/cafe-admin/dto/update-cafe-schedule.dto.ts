import {
  IsOptional,
  IsString,
  IsBoolean,
  Matches,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class DayScheduleDto {
  @ApiProperty({
    description: 'Opening time (HH:mm format)',
    example: '09:00',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Time must be in HH:mm format',
  })
  open?: string;

  @ApiProperty({
    description: 'Closing time (HH:mm format)',
    example: '22:00',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Time must be in HH:mm format',
  })
  close?: string;

  @ApiProperty({
    description: 'Is the cafe closed on this day',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  closed?: boolean;
}

export class UpdateCafeScheduleDto {
  @ApiProperty({ type: DayScheduleDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayScheduleDto)
  monday?: DayScheduleDto;

  @ApiProperty({ type: DayScheduleDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayScheduleDto)
  tuesday?: DayScheduleDto;

  @ApiProperty({ type: DayScheduleDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayScheduleDto)
  wednesday?: DayScheduleDto;

  @ApiProperty({ type: DayScheduleDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayScheduleDto)
  thursday?: DayScheduleDto;

  @ApiProperty({ type: DayScheduleDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayScheduleDto)
  friday?: DayScheduleDto;

  @ApiProperty({ type: DayScheduleDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayScheduleDto)
  saturday?: DayScheduleDto;

  @ApiProperty({ type: DayScheduleDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayScheduleDto)
  sunday?: DayScheduleDto;
}
