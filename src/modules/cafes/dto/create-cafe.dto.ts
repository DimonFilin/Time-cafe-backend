import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsOptional,
  Min,
  Max,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';

export class CreateCafeDto {
  @ApiProperty({ example: 'Coffee House Downtown', description: 'Cafe name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    example: 'Cozy coffee shop in the city center',
    description: 'Cafe description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    example: 'Минск, проспект Независимости, 1',
    description: 'Full address',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  address: string;

  @ApiProperty({ example: 'Минск', description: 'City name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @ApiPropertyOptional({
    example: 'Red Square',
    description: 'Street name',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  street?: string;

  @ApiProperty({
    example: 55.7539,
    description: 'Latitude (-90 to 90)',
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({
    example: 37.6208,
    description: 'Longitude (-180 to 180)',
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty({
    example: 'uuid',
    description: 'Brand ID',
  })
  @IsString()
  @IsNotEmpty()
  brandId: string;

  @ApiProperty({
    example: 'uuid',
    description: 'Region ID',
  })
  @IsString()
  @IsNotEmpty()
  regionId: string;

  @ApiPropertyOptional({
    example: ['http://example.com/photo1.jpg', 'http://example.com/photo2.jpg'],
    description: 'Array of photo URLs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  photos?: string[];

  @ApiPropertyOptional({
    example: 'http://localhost:3001',
    description: 'URL to local cafe service (backend-cafe)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cafeApiUrl?: string;
}
