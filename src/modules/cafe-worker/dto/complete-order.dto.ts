import { IsUUID } from 'class-validator';

export class CompleteOrderDto {
  @IsUUID()
  orderId: string;
}
