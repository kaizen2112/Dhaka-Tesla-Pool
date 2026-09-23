import { Module } from '@nestjs/common';
import { RideStateService } from './ride-state.service';

@Module({
  providers: [RideStateService],
})
export class RidesModule {}
