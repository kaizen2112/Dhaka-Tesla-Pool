import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class ResolveComplaintDto {
  // Not OPEN: a decision moves a complaint out of OPEN, never back into it.
  @IsIn(['RESOLVED', 'DISMISSED'])
  status: 'RESOLVED' | 'DISMISSED';

  // Required, so the passenger always learns why (and the driver what happened next).
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  resolutionNote: string;
}
