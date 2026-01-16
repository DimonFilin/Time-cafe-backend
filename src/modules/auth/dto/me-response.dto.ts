import { ApiProperty } from '@nestjs/swagger';
import { WorkerRole } from '@prisma/client';
import { UserProfileDto } from './user-profile.dto';

export class MeResponseDto extends UserProfileDto {
  @ApiProperty({
    example: 'USER',
    enum: ['USER', 'SYSTEM_ADMIN', 'BRAND_ADMIN', 'CAFE_ADMIN', 'WORKER'],
    description: 'Account role',
  })
  role: 'USER' | WorkerRole;

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
