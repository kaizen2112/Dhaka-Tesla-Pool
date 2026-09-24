import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min } from 'class-validator';
import { DHAKA_ZONES } from '../../location/locations';

const ZONE_CODES = Object.keys(DHAKA_ZONES);

// Same rules as CreateRideRequestDto: a quote for exactly what the passenger could book.
export class FareEstimateQueryDto {
  @IsIn(ZONE_CODES)
  pickupZone: string;

  @IsIn(ZONE_CODES)
  destinationZone: string;

  // Query strings arrive as text; convert before the integer checks.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  seats: number;
}
