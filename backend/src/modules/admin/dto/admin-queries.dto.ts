import { ComplaintStatus, UserRole } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class AdminUsersQuery {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class AdminComplaintsQuery {
  @IsOptional()
  @IsEnum(ComplaintStatus)
  status?: ComplaintStatus;
}
