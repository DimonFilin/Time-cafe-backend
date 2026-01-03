import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, Matches, MaxLength } from 'class-validator';

export class UpdateCustomizationDto {
  @ApiPropertyOptional({
    example: '#000000',
    description: 'Primary color (hex)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Primary color must be a valid hex color',
  })
  primaryColor?: string;

  @ApiPropertyOptional({
    example: '#FFFFFF',
    description: 'Secondary color (hex)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Secondary color must be a valid hex color',
  })
  secondaryColor?: string;

  @ApiPropertyOptional({
    example: '#007BFF',
    description: 'Accent color (hex)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Accent color must be a valid hex color',
  })
  accentColor?: string;

  @ApiPropertyOptional({
    example: '#F8F9FA',
    description: 'Background color (hex)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Background color must be a valid hex color',
  })
  backgroundColor?: string;

  @ApiPropertyOptional({ example: '#212529', description: 'Text color (hex)' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Text color must be a valid hex color',
  })
  textColor?: string;

  @ApiPropertyOptional({
    example: 'Inter, sans-serif',
    description: 'Font family',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fontFamily?: string;

  @ApiPropertyOptional({
    example: { theme: { mode: 'light' } },
    description: 'Additional settings (JSON)',
  })
  @IsOptional()
  settings?: Record<string, unknown>;
}
