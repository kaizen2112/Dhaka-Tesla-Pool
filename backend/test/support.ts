import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { User } from '@prisma/client';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// The real AppModule (global guards, pipe, filter) against the real test database.
export async function startApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  // Listen once up front: concurrent supertest calls on a non-listening server would each
  // try to start it.
  await app.listen(0);
  return app;
}

export async function resetDb(prisma: PrismaService) {
  if (!process.env.DATABASE_URL?.includes('_test')) {
    throw new Error('Refusing to wipe a database whose name does not contain "_test"');
  }
  await prisma.$executeRaw`
    TRUNCATE "WalletTransaction", "Wallet", "RideStatusHistory", "PoolMembership",
             "Pool", "RideRequest", "Vehicle", "User" CASCADE`;
}

// The story cast. Nobody logs in through the API here, so passwords are never checked.
export async function createCast(prisma: PrismaService) {
  const passenger = (name: string) =>
    prisma.user.create({
      data: {
        name,
        email: `${name.toLowerCase()}@teslapool.dev`,
        passwordHash: 'unused-in-e2e',
        role: 'PASSENGER',
      },
    });

  const jashim = await prisma.user.create({
    data: {
      name: 'Jashim',
      email: 'jashim@teslapool.dev',
      passwordHash: 'unused-in-e2e',
      role: 'DRIVER',
      vehicle: { create: { name: 'Bullet', capacity: 3, isOnline: true } },
    },
  });
  return {
    jashim,
    nusrat: await passenger('Nusrat'),
    rafiq: await passenger('Rafiq'),
    shirin: await passenger('Shirin'),
  };
}

// A real JWT signed with the app's own secret, same as login would issue.
export function bearer(app: INestApplication, user: Pick<User, 'id' | 'role'>) {
  return `Bearer ${app.get(JwtService).sign({ sub: user.id, role: user.role })}`;
}
