import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateRideRequestDto } from './dto/create-ride-request.dto';
import { RidesService } from './rides.service';

// Static routes (`me`, `pending`) must stay above `:id`, or Nest matches them as an id.
@Controller('ride-requests')
export class RideRequestsController {
  constructor(private readonly rides: RidesService) {}

  @Post()
  @Roles('PASSENGER')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRideRequestDto) {
    return this.rides.createRequest(user.id, dto);
  }

  @Get('me')
  @Roles('PASSENGER')
  listMine(@CurrentUser() user: AuthUser) {
    return this.rides.listMyRequests(user.id);
  }

  @Get('pending')
  @Roles('DRIVER')
  listPending(@CurrentUser() user: AuthUser) {
    return this.rides.listPending(user.id);
  }

  @Get(':id')
  @Roles('PASSENGER')
  getOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.rides.getRequest(user.id, id);
  }

  @Patch(':id/accept')
  @Roles('DRIVER')
  accept(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.rides.acceptRequest(user.id, id);
  }

  @Patch(':id/cancel')
  @Roles('PASSENGER')
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.rides.cancelRequest(user.id, id);
  }
}
