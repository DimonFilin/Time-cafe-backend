import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateRegionDto {
  @ApiProperty({ example: 'Москва и область' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'Россия' })
  @IsNotEmpty()
  @IsString()
  country: string;
}
