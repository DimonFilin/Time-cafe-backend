import { ApiProperty } from '@nestjs/swagger';

export class CafeMenuItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Stable key for import/export' })
  key: string;

  @ApiProperty()
  categoryId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false, nullable: true })
  description?: string | null;

  @ApiProperty({ description: 'Decimal as string', example: '290.00' })
  price: string;

  @ApiProperty({ example: 'BYN' })
  currency: string;

  @ApiProperty({ required: false, nullable: true })
  photoUrl?: string | null;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  isActive: boolean;
}

export class CafeMenuCategoryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Stable key for import/export' })
  key: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false, nullable: true })
  description?: string | null;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ type: [CafeMenuItemDto] })
  items: CafeMenuItemDto[];
}

export class CafeMenuResponseDto {
  @ApiProperty()
  cafeId: string;

  @ApiProperty({ type: [CafeMenuCategoryDto] })
  categories: CafeMenuCategoryDto[];
}
