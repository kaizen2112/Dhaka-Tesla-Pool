import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { FareEstimateQueryDto } from './dto/fare-estimate.query';
import { FareService } from './fare.service';

@Controller('fares')
export class FaresController {
  constructor(private readonly fares: FareService) {}

  @Get('estimate')
  @Roles('PASSENGER')
  estimate(@Query() query: FareEstimateQueryDto) {
    return this.fares.estimate(query);
  }
}
