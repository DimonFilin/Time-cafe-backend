import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
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
  Matches,
  IsIn,
  ValidateNested,
} from 'class-validator';
import {
  CAFE_OCCUPANCY_MODES,
  CAFE_PHONE_FORMAT_HINT,
  CAFE_PHONE_REGEX,
  IsCafeEmail,
} from '../../../common/cafe/cafe-field-validators';
import { UpdateCafeScheduleDto } from '../../cafe-admin/dto/update-cafe-schedule.dto';

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

  @ApiPropertyOptional({
    example: '+375-29-123-45-67',
    description: CAFE_PHONE_FORMAT_HINT,
  })
  @IsOptional()
  @IsString()
  @Matches(CAFE_PHONE_REGEX, {
    message: CAFE_PHONE_FORMAT_HINT,
  })
  phone?: string;

  @ApiPropertyOptional({
    example: 'cafe@example.com',
    description: 'Email (exactly one @)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @IsCafeEmail()
  email?: string;

  @ApiPropertyOptional({
    enum: CAFE_OCCUPANCY_MODES,
    default: 'PERCENT',
  })
  @IsOptional()
  @IsIn([...CAFE_OCCUPANCY_MODES])
  occupancyMode?: string;

  @ApiPropertyOptional({ type: UpdateCafeScheduleDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateCafeScheduleDto)
  schedule?: UpdateCafeScheduleDto;
}
