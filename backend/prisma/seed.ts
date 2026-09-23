// Idempotent: upserts by email, so this can run on every container start
// (docs/PLAN.md Day 3) without duplicating users or wallet credits.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEMO_PASSWORD = 'password123';
const WALLET_TOPUP_POYSHA = 50000; // ৳500, docs/DATABASE.md → Seed data

async function upsertUser(email: string, name: string, role: UserRole) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, role, passwordHash },
  });
}

// Credits the wallet once, via a CREDIT WalletTransaction, never a second time.
async function ensureWalletCredited(userId: string) {
  const wallet = await prisma.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  const alreadyCredited = await prisma.walletTransaction.findFirst({
    where: { walletId: wallet.id, type: 'CREDIT' },
  });
  if (alreadyCredited) return;

  await prisma.$transaction([
    prisma.walletTransaction.create({
      data: { walletId: wallet.id, type: 'CREDIT', amountPoysha: WALLET_TOPUP_POYSHA },
    }),
    prisma.wallet.update({
      where: { id: wallet.id },
      data: { balancePoysha: { increment: WALLET_TOPUP_POYSHA } },
    }),
  ]);
}

async function main() {
  const jashim = await upsertUser('jashim@teslapool.dev', 'Jashim', 'DRIVER');
  await prisma.vehicle.upsert({
    where: { driverId: jashim.id },
    update: {},
    create: { driverId: jashim.id, name: 'Bullet', capacity: 3, isOnline: false },
  });

  const passengers = [
    ['nusrat@teslapool.dev', 'Nusrat'],
    ['rafiq@teslapool.dev', 'Rafiq'],
    ['shirin@teslapool.dev', 'Shirin'],
  ] as const;

  for (const [email, name] of passengers) {
    const passenger = await upsertUser(email, name, 'PASSENGER');
    await ensureWalletCredited(passenger.id);
  }

  console.log('Seed complete: Jashim/Bullet + Nusrat, Rafiq, Shirin (each ৳500 wallet).');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
