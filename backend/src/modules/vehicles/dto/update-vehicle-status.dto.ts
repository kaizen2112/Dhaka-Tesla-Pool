import { IsBoolean } from 'class-validator';

export class UpdateVehicleStatusDto {
  @IsBoolean()
  isOnline: boolean;
}
