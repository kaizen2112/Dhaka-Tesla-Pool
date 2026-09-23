import { Module } from '@nestjs/common';
import { LocationModule } from '../location/location.module';
import { MatchingService } from './matching.service';
import { RideStateService } from './ride-state.service';

@Module({
  imports: [LocationModule],
  providers: [RideStateService, MatchingService],
})
export class RidesModule {}
