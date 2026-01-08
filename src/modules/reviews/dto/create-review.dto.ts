import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  Max,
  IsUUID,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({
    example: 'cafe-uuid-123',
    description: 'Cafe ID',
  })
  @IsNotEmpty()
  @IsUUID()
  cafeId: string;

  @ApiPropertyOptional({
    example: 'order-uuid-123',
    description: 'Order ID (optional, for reviews linked to completed orders)',
  })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiProperty({
    example: 4.5,
    description: 'Rating from 0.0 to 5.0',
    minimum: 0,
    maximum: 5,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({
    example: 'Отличная кофейня! Очень уютная атмосфера и вкусный кофе.',
    description: 'Main review comment',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @ApiPropertyOptional({
    example: ['Вкусный кофе', 'Уютная атмосфера', 'Быстрое обслуживание'],
    description: 'Pros (positive aspects)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  @MaxLength(100, { each: true })
  pros?: string[];

  @ApiPropertyOptional({
    example: ['Дорого', 'Мало места'],
    description: 'Cons (negative aspects)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  @MaxLength(100, { each: true })
  cons?: string[];

  @ApiPropertyOptional({
    example: [
      'https://example.com/photo1.jpg',
      'https://example.com/photo2.jpg',
    ],
    description: 'Review photos URLs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  photos?: string[];
}
