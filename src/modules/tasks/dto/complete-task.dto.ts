import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsInt,
  Min,
} from 'class-validator';

export class CompleteTaskDto {
  @ApiProperty({
    description: 'Completion date (YYYY-MM-DD)',
    example: '2024-01-15',
  })
  @IsDateString()
  completionDate: string;

  @ApiPropertyOptional({
    description: 'Photo URL (if task requires photo)',
    example: 'https://storage.example.com/photo.jpg',
  })
  @IsString()
  @IsOptional()
  photoUrl?: string;

  @ApiPropertyOptional({
    description: 'Comment (if task requires comment)',
    example: 'Все в порядке',
  })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiPropertyOptional({ description: 'Duration in minutes', example: 8 })
  @IsInt()
  @Min(1)
  @IsOptional()
  durationMinutes?: number;
}
