import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PayDto } from './dto/pay.dto';
import { PaymentsService } from './payments.service';

// Serves /payments/* and /wallet/me (docs/ARCHITECTURE.md §9). Passengers only.
@Controller()
@Roles('PASSENGER')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('payments/:poolMembershipId')
  pay(
    @CurrentUser() user: AuthUser,
    @Param('poolMembershipId', ParseUUIDPipe) membershipId: string,
    @Body() dto: PayDto,
  ) {
    return this.payments.pay(user.id, membershipId, dto.method);
  }

  @Get('wallet/me')
  getMyWallet(@CurrentUser() user: AuthUser) {
    return this.payments.getMyWallet(user.id);
  }
}
