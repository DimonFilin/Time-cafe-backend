import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewResponseDto {
  @ApiProperty({ example: 'review-uuid-123' })
  id: string;

  @ApiProperty({ example: 'user-uuid-123' })
  userId: string;

  @ApiProperty({ example: 'Иван' })
  userName: string;

  @ApiProperty({ example: 'cafe-uuid-123' })
  cafeId: string;

  @ApiPropertyOptional({ example: 'order-uuid-123' })
  orderId?: string;

  @ApiProperty({ example: 4.5, description: 'Rating from 0.0 to 5.0' })
  rating: number;

  @ApiPropertyOptional({
    example: 'Отличная кофейня! Очень уютная атмосфера и вкусный кофе.',
  })
  comment?: string;

  @ApiPropertyOptional({
    example: ['Вкусный кофе', 'Уютная атмосфера'],
    type: [String],
  })
  pros?: string[];

  @ApiPropertyOptional({
    example: ['Дорого'],
    type: [String],
  })
  cons?: string[];

  @ApiPropertyOptional({
    example: ['https://example.com/photo1.jpg'],
    type: [String],
  })
  photos?: string[];

  @ApiProperty({ example: false })
  isVerified: boolean;

  @ApiPropertyOptional({ example: '2025-01-07T12:00:00Z' })
  verifiedAt?: Date;

  @ApiProperty({ example: '2025-01-07T10:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-01-07T10:00:00Z' })
  updatedAt: Date;
}
