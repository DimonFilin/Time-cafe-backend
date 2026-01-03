import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class GeocodeDto {
  @ApiProperty({
    example: 'Moscow, Red Square, 1',
    description: 'Address to geocode',
  })
  @IsString()
  @IsNotEmpty()
  address: string;
}

export class GeocodeResponseDto {
  @ApiProperty({
    example: 55.7539,
    description: 'Latitude',
  })
  latitude: number;

  @ApiProperty({
    example: 37.6208,
    description: 'Longitude',
  })
  longitude: number;

  @ApiProperty({
    example: 'Moscow, Red Square, 1',
    description: 'Formatted address',
  })
  formattedAddress: string;

  @ApiProperty({
    example: 'Moscow',
    description: 'City name',
  })
  city?: string;

  @ApiProperty({
    example: 'Russia',
    description: 'Country name',
  })
  country?: string;
}
