import { Module } from '@nestjs/common';
import { FareModule } from '../fares/fare.module';
import { LocationModule } from '../location/location.module';
import { MatchingService } from './matching.service';
import { PoolsController } from './pools.controller';
import { RideRequestsController } from './ride-requests.controller';
import { RideStateService } from './ride-state.service';
import { RidesService } from './rides.service';

@Module({
  imports: [LocationModule, FareModule],
  controllers: [RideRequestsController, PoolsController],
  providers: [RidesService, RideStateService, MatchingService],
})
export class RidesModule {}
