import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { FeedbackService } from '../feedback/feedback.service';
import { RidesService } from '../rides/rides.service';
import { AdminService } from './admin.service';
import { AdminComplaintsQuery, AdminUsersQuery } from './dto/admin-queries.dto';
import { ResolveComplaintDto } from './dto/resolve-complaint.dto';

// /admin/* (docs/API_SPEC.md → Admin). Class-level role, so no route can forget it.
// Each handler calls one service: reads from AdminService / RidesService, the one write
// (deciding a complaint) through FeedbackService, the only writer of complaints.
@Controller('admin')
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly rides: RidesService,
    private readonly feedback: FeedbackService,
  ) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('users')
  users(@Query() query: AdminUsersQuery) {
    return this.admin.users(query.role);
  }

  @Get('pools')
  pools() {
    return this.rides.listAllPools();
  }

  @Get('complaints')
  complaints(@Query() query: AdminComplaintsQuery) {
    return this.admin.complaints(query.status);
  }

  @Patch('complaints/:id')
  decide(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveComplaintDto,
  ) {
    return this.feedback.resolveComplaint(user.id, id, dto.status, dto.resolutionNote);
  }
}
