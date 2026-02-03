import { ApiProperty } from '@nestjs/swagger';

export class AdminUserListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  keycloakId: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ required: false, nullable: true })
  phone?: string | null;

  @ApiProperty({ required: false, nullable: true })
  avatar?: string | null;

  @ApiProperty({ type: 'number', format: 'decimal' })
  balance: number;

  @ApiProperty({ required: false, nullable: true })
  deletedAt?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
