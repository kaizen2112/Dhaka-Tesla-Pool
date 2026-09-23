import { Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RidesService } from './rides.service';

// Reads are open to both roles; RidesService decides who may see which pool (driver or member).
@Controller('pools')
export class PoolsController {
  constructor(private readonly rides: RidesService) {}

  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.rides.getPool(user, id);
  }

  @Get(':id/history')
  history(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.rides.getPoolHistory(user, id);
  }

  @Get(':id/fares')
  fares(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.rides.getPoolFares(user, id);
  }

  @Patch(':id/arrived')
  @Roles('DRIVER')
  arrived(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.rides.transitionPool(user.id, id, 'DRIVER_ARRIVED');
  }

  @Patch(':id/start')
  @Roles('DRIVER')
  start(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.rides.transitionPool(user.id, id, 'STARTED');
  }

  @Patch(':id/complete')
  @Roles('DRIVER')
  complete(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.rides.transitionPool(user.id, id, 'COMPLETED');
  }
}
