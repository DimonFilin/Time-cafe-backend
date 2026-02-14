import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InviteWorkerDto {
  @ApiProperty({
    description: 'Worker email address',
    example: 'worker@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Worker first name',
    example: 'John',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @ApiProperty({
    description: 'Worker last name',
    example: 'Doe',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName: string;

  @ApiProperty({
    description: 'Worker password (min 8 characters)',
    example: 'SecurePass123',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;
}
