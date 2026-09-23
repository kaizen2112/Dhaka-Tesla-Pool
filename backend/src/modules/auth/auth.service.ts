import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

// Never return passwordHash.
function toPublicUser(user: User) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email.toLowerCase(),
          passwordHash,
          role: dto.role,
          // Nested create runs in the same transaction: a passenger never exists without a wallet.
          wallet: dto.role === 'PASSENGER' ? { create: {} } : undefined,
        },
      });
      return this.issueToken(user);
    } catch (error) {
      // Unique violation on email — caught here instead of a pre-check, so two simultaneous
      // sign-ups with the same email can't both pass.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainException('EMAIL_TAKEN', HttpStatus.CONFLICT, 'That email is already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    // Same error for unknown email and wrong password, so the API doesn't reveal which emails exist.
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new DomainException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED, 'Invalid email or password');
    }
    return this.issueToken(user);
  }

  async me(userId: string) {
    return toPublicUser(await this.prisma.user.findUniqueOrThrow({ where: { id: userId } }));
  }

  private async issueToken(user: User) {
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return { accessToken, user: toPublicUser(user) };
  }
}
