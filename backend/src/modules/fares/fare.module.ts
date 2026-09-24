import { Module } from '@nestjs/common';
import { LocationModule } from '../location/location.module';
import { FareService } from './fare.service';
import { FaresController } from './fares.controller';

@Module({
  imports: [LocationModule],
  controllers: [FaresController],
  providers: [FareService],
  exports: [FareService],
})
export class FareModule {}
