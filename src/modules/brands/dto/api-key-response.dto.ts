import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiKeyResponseDto {
  @ApiProperty({ example: 'uuid', description: 'API key ID' })
  id: string;

  @ApiProperty({ example: 'Production API Key', description: 'API key name' })
  name: string;

  @ApiProperty({
    example: 'tc_live',
    description: 'Key prefix (first 8 characters)',
  })
  prefix: string;

  @ApiProperty({
    example: ['brands:create', 'brands:read'],
    description: 'Array of permissions',
    type: [String],
  })
  permissions: string[];

  @ApiProperty({ example: true, description: 'Is key active' })
  isActive: boolean;

  @ApiPropertyOptional({
    example: '2025-01-01T00:00:00.000Z',
    description: 'Last usage date',
  })
  lastUsedAt?: Date;

  @ApiPropertyOptional({
    example: '2025-12-31T23:59:59.000Z',
    description: 'Expiration date',
  })
  expiresAt?: Date;

  @ApiProperty({
    example: '2025-01-01T00:00:00.000Z',
    description: 'Creation date',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2025-01-01T00:00:00.000Z',
    description: 'Last update date',
  })
  updatedAt: Date;
}
