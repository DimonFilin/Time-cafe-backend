import { ApiProperty } from '@nestjs/swagger';
import { AppointmentResponseDto } from './appointment-response.dto';

export class AppointmentListResponseDto {
  @ApiProperty({
    description: 'Массив бронирований',
    type: [AppointmentResponseDto],
  })
  items: AppointmentResponseDto[];

  @ApiProperty({
    description: 'Общее количество бронирований',
    example: 25,
  })
  total: number;

  @ApiProperty({
    description: 'Текущая страница',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Размер страницы',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Общее количество страниц',
    example: 2,
  })
  totalPages: number;
}
