import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleStatusDto } from './dto/update-vehicle-status.dto';
import { VehiclesService } from './vehicles.service';

// "me" routes act on the caller's own vehicle, so there's no id another driver could swap in.
@Controller('vehicles')
@Roles('DRIVER')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateVehicleDto) {
    return this.vehicles.create(user.id, dto);
  }

  @Get('me')
  getMine(@CurrentUser() user: AuthUser) {
    return this.vehicles.getMine(user.id);
  }

  @Patch('me/status')
  setStatus(@CurrentUser() user: AuthUser, @Body() dto: UpdateVehicleStatusDto) {
    return this.vehicles.setStatus(user.id, dto.isOnline);
  }
}
