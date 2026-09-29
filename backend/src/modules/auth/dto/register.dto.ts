import { IsEmail, IsIn, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

// Not @IsEnum(UserRole): that enum includes ADMIN, and nobody may sign themselves up as admin.
// The only admin is seeded (docs/DATABASE.md → Seed data).
export const SELF_SERVE_ROLES = ['PASSENGER', 'DRIVER'] as const;

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt ignores anything past 72 bytes
  password: string;

  @IsIn(SELF_SERVE_ROLES)
  role: (typeof SELF_SERVE_ROLES)[number];
}
