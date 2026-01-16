import { ApiProperty } from '@nestjs/swagger';
import { AccountInfoDto } from './account-info.dto';

export class LoginLookupResponseDto {
  @ApiProperty({
    type: [AccountInfoDto],
    description: 'List of available accounts for this email',
  })
  accounts: AccountInfoDto[];

  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ...',
    description: 'Temporary lookup token (refresh token) for account selection',
  })
  lookupToken: string;
}
