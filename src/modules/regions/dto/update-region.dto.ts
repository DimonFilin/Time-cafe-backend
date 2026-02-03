import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateRegionDto {
  @ApiPropertyOptional({ example: 'Москва и область' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Россия' })
  @IsOptional()
  @IsString()
  country?: string;
}
