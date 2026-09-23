import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateRideRequestDto } from './dto/create-ride-request.dto';
import { RidesService } from './rides.service';

// Static routes (`me`, and `pending` in commit 11) must stay above `:id`.
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

  @Get(':id')
  @Roles('PASSENGER')
  getOne(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.rides.getRequest(user.id, id);
  }
}
