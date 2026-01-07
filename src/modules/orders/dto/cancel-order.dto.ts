import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelOrderDto {
  @ApiPropertyOptional({
    example: 'Changed my mind',
    description: 'Cancellation reason',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
