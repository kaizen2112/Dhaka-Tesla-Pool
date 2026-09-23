import { HttpStatus, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { DomainException } from './common/exceptions/domain.exception';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { RidesModule } from './modules/rides/rides.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    // Loads backend/.env into process.env (PrismaService reads DATABASE_URL from it).
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow('JWT_SECRET'),
        signOptions: { expiresIn: config.getOrThrow('JWT_EXPIRES_IN') },
      }),
    }),
    PrismaModule,
    AuthModule,
    VehiclesModule,
    RidesModule,
    PaymentsModule,
    HealthModule,
  ],
  // Registered as APP_* providers (not in main.ts) so e2e tests get them too.
  // Guards run in this order: JWT first, then roles.
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        exceptionFactory: (errors) =>
          new DomainException(
            'VALIDATION_ERROR',
            HttpStatus.BAD_REQUEST,
            errors.flatMap((e) => Object.values(e.constraints ?? {})).join('; '),
          ),
      }),
    },
  ],
})
export class AppModule {}
