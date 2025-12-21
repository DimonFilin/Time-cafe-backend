import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { WorkerRole } from '@prisma/client';

export class RegisterWorkerDto {
  @ApiProperty({
    example: 'worker@example.com',
    description: 'Worker email address',
  })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    description: 'Worker password (minimum 8 characters)',
    minLength: 8,
  })
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiProperty({
    example: 'John',
    description: 'Worker first name',
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Worker last name',
  })
  @IsString()
  lastName: string;

  @ApiProperty({
    example: 'CAFE_ADMIN',
    description: 'Worker role',
    enum: WorkerRole,
  })
  @IsEnum(WorkerRole, { message: 'Role must be a valid WorkerRole' })
  role: WorkerRole;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Brand ID (optional, required for BRAND_ADMIN and CAFE_ADMIN)',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174001',
    description: 'Cafe ID (optional, required for CAFE_ADMIN and WORKER)',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  cafeId?: string;
}
