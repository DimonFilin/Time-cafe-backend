import { ApiProperty } from '@nestjs/swagger';
import { WorkerRole } from '@prisma/client';

export class UserProfileDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'User ID',
  })
  id: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  email: string;

  @ApiProperty({
    example: 'John',
    description: 'User first name',
  })
  firstName: string;

  @ApiProperty({
    example: 'Doe',
    description: 'User last name',
  })
  lastName: string;

  @ApiProperty({
    example: '+1234567890',
    description: 'User phone number',
    required: false,
    nullable: true,
  })
  phone?: string | null;

  @ApiProperty({
    example: 'https://example.com/avatar.jpg',
    description: 'User avatar URL',
    required: false,
    nullable: true,
  })
  avatar?: string | null;

  @ApiProperty({
    example: '0.00',
    description: 'User balance',
  })
  balance: string;

  @ApiProperty({
    example: '2025-01-01T00:00:00.000Z',
    description: 'User creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: 'USER',
    enum: ['USER', 'SYSTEM_ADMIN', 'BRAND_ADMIN', 'CAFE_ADMIN', 'WORKER'],
    description: 'Account role',
    required: false,
  })
  role?: 'USER' | WorkerRole;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'Brand ID (for BRAND_ADMIN role)',
    required: false,
    nullable: true,
  })
  brandId?: string | null;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440002',
    description: 'Cafe ID (for CAFE_ADMIN and WORKER roles)',
    required: false,
    nullable: true,
  })
  cafeId?: string | null;
}
