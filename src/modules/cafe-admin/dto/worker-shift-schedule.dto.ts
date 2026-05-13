import {
  IsBoolean,
  IsEnum,
  IsOptional,
  Matches,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { WorkerScheduleAbsenceKind } from '@prisma/client';

export class TimeSegmentDto {
  @ApiProperty({ example: '09:00' })
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
  open!: string;

  @ApiProperty({ example: '18:00' })
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
  close!: string;
}

export class DayShiftTemplateDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  closed?: boolean;

  @ApiProperty({ type: [TimeSegmentDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSegmentDto)
  segments?: TimeSegmentDto[];

  @ApiProperty({ required: false, description: 'Legacy single interval' })
  @IsOptional()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
  open?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
  close?: string;
}

export class UpdateWorkerShiftScheduleDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => DayShiftTemplateDto)
  monday?: DayShiftTemplateDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DayShiftTemplateDto)
  tuesday?: DayShiftTemplateDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DayShiftTemplateDto)
  wednesday?: DayShiftTemplateDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DayShiftTemplateDto)
  thursday?: DayShiftTemplateDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DayShiftTemplateDto)
  friday?: DayShiftTemplateDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DayShiftTemplateDto)
  saturday?: DayShiftTemplateDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DayShiftTemplateDto)
  sunday?: DayShiftTemplateDto;
}

export class CreateWorkerScheduleAbsenceDto {
  @ApiProperty({ example: '2026-06-01' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startYmd!: string;

  @ApiProperty({ example: '2026-06-07' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endYmd!: string;

  @ApiProperty({ enum: WorkerScheduleAbsenceKind })
  @IsEnum(WorkerScheduleAbsenceKind)
  kind!: WorkerScheduleAbsenceKind;
}
