import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ReverseGeocodeDto {
  @ApiProperty({
    example: 55.7539,
    description: 'Latitude',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({
    example: 37.6208,
    description: 'Longitude',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
}

export class ReverseGeocodeResponseDto {
  @ApiProperty({
    example: 'Минск, проспект Независимости, 1',
    description: 'Formatted address',
  })
  formattedAddress: string;

  @ApiProperty({
    example: 'Минск',
    description: 'City name',
  })
  city?: string;

  @ApiProperty({
    example: 'Беларусь',
    description: 'Country name',
  })
  country?: string;

  @ApiProperty({
    example: 'Red Square',
    description: 'Street name',
  })
  street?: string;
}
