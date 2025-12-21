import { ApiProperty } from '@nestjs/swagger';
import { UserProfileDto } from './user-profile.dto';

export class AuthResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ...',
    description: 'JWT access token',
  })
  accessToken: string;

  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ...',
    description: 'JWT refresh token',
  })
  refreshToken: string;

  @ApiProperty({
    example: 900,
    description: 'Access token expiration time in seconds',
  })
  expiresIn: number;

  @ApiProperty({
    type: UserProfileDto,
    description: 'User profile information',
  })
  user: UserProfileDto;
}
