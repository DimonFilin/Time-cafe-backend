import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail({}, { message: 'Впишите правильный email, пожалуйста' })
  email: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    description: 'User password (minimum 8 characters)',
    minLength: 8,
  })
  @IsString({ message: 'Укажите пароль' })
  @MinLength(8, { message: 'Пароль должен быть не короче 8 символов' })
  password: string;

  @ApiProperty({
    example: 'John',
    description: 'User first name',
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    example: 'Doe',
    description: 'User last name',
  })
  @IsString()
  lastName: string;

  @ApiProperty({
    example: '+1234567890',
    description: 'User phone number (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;
}
