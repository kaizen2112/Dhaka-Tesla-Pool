import { IsIn, IsInt, Max, Min } from 'class-validator';
import { DHAKA_ZONES } from '../../location/locations';

const ZONE_CODES = Object.keys(DHAKA_ZONES);

export class CreateRideRequestDto {
  @IsIn(ZONE_CODES)
  pickupZone: string;

  @IsIn(ZONE_CODES)
  destinationZone: string;

  // 7 = the largest allowed vehicle capacity; whether it fits a given pool is matching's job.
  @IsInt()
  @Min(1)
  @Max(7)
  seats: number;
}
