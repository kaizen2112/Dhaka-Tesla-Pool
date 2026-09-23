import { Module } from '@nestjs/common';
import { LocationModule } from '../location/location.module';
import { FareService } from './fare.service';

@Module({
  imports: [LocationModule],
  providers: [FareService],
  exports: [FareService],
})
export class FareModule {}
