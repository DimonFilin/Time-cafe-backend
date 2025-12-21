import { ApiProperty } from '@nestjs/swagger';

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
}
