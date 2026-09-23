import { PaymentMethod } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class PayDto {
  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}
