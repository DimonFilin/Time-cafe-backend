import { ApiProperty } from '@nestjs/swagger';
import { ApiKeyResponseDto } from './api-key-response.dto';

export class CreateApiKeyResponseDto extends ApiKeyResponseDto {
  @ApiProperty({
    example: 'tc_live_sk_test_1234567890abcdef',
    description: 'Full API key (shown only once)',
  })
  key: string;
}
