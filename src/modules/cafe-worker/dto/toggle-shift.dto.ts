import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleShiftStatusDto {
  @ApiProperty({
    required: false,
    description: 'Set true after user confirms off-window toggle',
  })
  @IsOptional()
  @IsBoolean()
  confirmOutsideSchedule?: boolean;
}
