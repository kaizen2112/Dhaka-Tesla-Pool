import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { CreateRatingDto } from './dto/create-rating.dto';
import { FeedbackService } from './feedback.service';

// Serves /ratings/:id, /complaints/:id and /drivers/me/profile (docs/API_SPEC.md → Feedback).
@Controller()
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post('ratings/:poolMembershipId')
  @Roles('PASSENGER')
  rate(
    @CurrentUser() user: AuthUser,
    @Param('poolMembershipId', ParseUUIDPipe) membershipId: string,
    @Body() dto: CreateRatingDto,
  ) {
    return this.feedback.rate(user.id, membershipId, dto);
  }

  @Post('complaints/:poolMembershipId')
  @Roles('PASSENGER')
  complain(
    @CurrentUser() user: AuthUser,
    @Param('poolMembershipId', ParseUUIDPipe) membershipId: string,
    @Body() dto: CreateComplaintDto,
  ) {
    return this.feedback.complain(user.id, membershipId, dto);
  }

  @Get('drivers/me/profile')
  @Roles('DRIVER')
  profile(@CurrentUser() user: AuthUser) {
    return this.feedback.driverProfile(user.id);
  }
}
