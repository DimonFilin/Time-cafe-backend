import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class LoginSelectDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Account ID to select',
  })
  @IsUUID()
  accountId: string;

  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ...',
    description: 'Lookup token from login/lookup step',
  })
  @IsString()
  lookupToken: string;
}
