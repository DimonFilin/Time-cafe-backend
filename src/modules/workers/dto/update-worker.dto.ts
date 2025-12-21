import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { WorkerRole } from '@prisma/client';

export class UpdateWorkerDto {
  @ApiProperty({
    example: 'John',
    description: 'Worker first name',
    required: false,
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Worker last name',
    required: false,
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({
    example: 'CAFE_ADMIN',
    description: 'Worker role',
    enum: WorkerRole,
    required: false,
  })
  @IsOptional()
  @IsEnum(WorkerRole)
  role?: WorkerRole;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Brand ID',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174001',
    description: 'Cafe ID',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  cafeId?: string;
}
