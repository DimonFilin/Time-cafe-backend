import { IsUUID } from 'class-validator';

export class ConfirmOrderDto {
  @IsUUID()
  orderId: string;
}
