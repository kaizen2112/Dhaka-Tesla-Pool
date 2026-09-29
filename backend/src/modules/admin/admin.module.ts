import { Module } from '@nestjs/common';
import { FeedbackModule } from '../feedback/feedback.module';
import { RidesModule } from '../rides/rides.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [RidesModule, FeedbackModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
