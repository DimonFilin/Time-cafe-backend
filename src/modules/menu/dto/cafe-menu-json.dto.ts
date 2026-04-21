import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CafeMenuJsonCategoryV1Dto {
  @IsString()
  key: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CafeMenuJsonItemV1Dto {
  @IsString()
  key: string;

  @IsString()
  categoryKey: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CafeMenuJsonV1Dto {
  @IsOptional()
  @IsInt()
  @IsIn([1])
  version?: 1;

  @IsOptional()
  @IsString()
  cafeId?: string;

  @IsOptional()
  @IsString()
  generatedAt?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CafeMenuJsonCategoryV1Dto)
  categories: CafeMenuJsonCategoryV1Dto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CafeMenuJsonItemV1Dto)
  items: CafeMenuJsonItemV1Dto[];
}
