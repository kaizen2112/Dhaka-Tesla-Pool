import { INestApplication } from '@nestjs/common';
import { User } from '@prisma/client';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { as, Cast, createCast, resetDb, startApp } from './support';

// The risky behaviour the brief asks us to test (docs/PRD.md → Testing), end to end against
// real Postgres, with the story cast.
describe('Ride rules', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cast: Cast;

  beforeAll(async () => {
    app = await startApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
    cast = await createCast(prisma);
  });

  function expectError(res: { status: number; body: { error?: string } }, status: number, code: string) {
    expect(res.status).toBe(status);
    expect(res.body.error).toBe(code);
  }

  async function book(user: User, destinationZone: string) {
    const res = await as(app, user)
      .post('/ride-requests', { pickupZone: 'BANANI', destinationZone, seats: 1 })
      .expect(201);
    return res.body;
  }

  // The canonical start (docs/DATABASE.md → Seed data): Nusrat books and waits, Jashim
  // accepts (creating the pool), Rafiq books and auto-joins.
  async function nusratAndRafiqPool() {
    const nusrat = await book(cast.nusrat, 'MOHAKHALI');
    const accepted = await as(app, cast.jashim)
      .patch(`/ride-requests/${nusrat.request.id}/accept`)
      .expect(200);
    const rafiq = await book(cast.rafiq, 'GULSHAN_1');
    expect(rafiq.request.status).toBe('MATCHED');
    return {
      poolId: accepted.body.id as string,
      nusratBooking: nusrat,
      acceptedPool: accepted.body,
      rafiqBooking: rafiq,
    };
  }

  // arrived → start → complete; returns the driver's view of the completed pool.
  async function runTrip(poolId: string) {
    const jashim = as(app, cast.jashim);
    await jashim.patch(`/pools/${poolId}/arrived`).expect(200);
    await jashim.patch(`/pools/${poolId}/start`).expect(200);
    const completed = await jashim.patch(`/pools/${poolId}/complete`).expect(200);
    return completed.body;
  }

  function membershipId(driverPoolView: { members: { passengerName: string; membershipId: string }[] }, name: string) {
    return driverPoolView.members.find((m) => m.passengerName === name)!.membershipId;
  }

  describe('authorization', () => {
    it("Rafiq can't read or cancel Nusrat's ride", async () => {
      const { nusratBooking } = await nusratAndRafiqPool();
      const rafiq = as(app, cast.rafiq);

      expectError(await rafiq.get(`/ride-requests/${nusratBooking.request.id}`), 403, 'FORBIDDEN');
      expectError(
        await rafiq.patch(`/ride-requests/${nusratBooking.request.id}/cancel`),
        403,
        'FORBIDDEN',
      );

      const stillHers = await prisma.rideRequest.findUniqueOrThrow({
        where: { id: nusratBooking.request.id },
      });
      expect(stillHers.status).toBe('MATCHED');
    });

    it("Rafiq can't pay for Nusrat's ride", async () => {
      const { poolId } = await nusratAndRafiqPool();
      const completed = await runTrip(poolId);

      const res = await as(app, cast.rafiq).post(
        `/payments/${membershipId(completed, 'Nusrat')}`,
        { method: 'CASH' },
      );
      expectError(res, 403, 'FORBIDDEN');
    });

    it("Karim, another driver, can't see or move Jashim's pool", async () => {
      const { poolId } = await nusratAndRafiqPool();
      const karim = as(app, cast.karim);

      expectError(await karim.get(`/pools/${poolId}`), 403, 'FORBIDDEN');
      expectError(await karim.patch(`/pools/${poolId}/arrived`), 403, 'FORBIDDEN');

      const pool = await prisma.pool.findUniqueOrThrow({ where: { id: poolId } });
      expect(pool.status).toBe('MATCHED');
    });

    it("a passenger can't use driver routes", async () => {
      const { poolId } = await nusratAndRafiqPool();
      const nusrat = as(app, cast.nusrat);

      expectError(await nusrat.get('/ride-requests/pending'), 403, 'FORBIDDEN');
      expectError(await nusrat.patch(`/pools/${poolId}/arrived`), 403, 'FORBIDDEN');
      expectError(await nusrat.patch('/vehicles/me/status', { isOnline: false }), 403, 'FORBIDDEN');
    });
  });

  describe('state transitions', () => {
    it('rejects start before arrived', async () => {
      const { poolId } = await nusratAndRafiqPool();
      expectError(
        await as(app, cast.jashim).patch(`/pools/${poolId}/start`),
        409,
        'INVALID_TRANSITION',
      );
    });

    it('rejects completing a trip twice', async () => {
      const { poolId } = await nusratAndRafiqPool();
      await runTrip(poolId);
      expectError(
        await as(app, cast.jashim).patch(`/pools/${poolId}/complete`),
        409,
        'INVALID_TRANSITION',
      );
    });

    it('rejects cancelling once the trip has started, and leaves the pool untouched', async () => {
      const { poolId, rafiqBooking } = await nusratAndRafiqPool();
      const jashim = as(app, cast.jashim);
      await jashim.patch(`/pools/${poolId}/arrived`).expect(200);
      await jashim.patch(`/pools/${poolId}/start`).expect(200);

      expectError(
        await as(app, cast.rafiq).patch(`/ride-requests/${rafiqBooking.request.id}/cancel`),
        409,
        'INVALID_TRANSITION',
      );

      const pool = await prisma.pool.findUniqueOrThrow({ where: { id: poolId } });
      expect(pool.status).toBe('STARTED');
      expect(pool.occupiedSeats).toBe(2);
    });
  });

  describe('cancellation', () => {
    it("releases Rafiq's seat and keeps Nusrat's trip going", async () => {
      const { poolId, rafiqBooking, nusratBooking } = await nusratAndRafiqPool();

      const res = await as(app, cast.rafiq)
        .patch(`/ride-requests/${rafiqBooking.request.id}/cancel`)
        .expect(200);
      expect(res.body.request.status).toBe('CANCELLED');
      expect(res.body.membership.cancelledAt).not.toBeNull();

      const pool = await prisma.pool.findUniqueOrThrow({ where: { id: poolId } });
      expect(pool.status).toBe('MATCHED');
      expect(pool.occupiedSeats).toBe(1);
      const nusrat = await prisma.rideRequest.findUniqueOrThrow({
        where: { id: nusratBooking.request.id },
      });
      expect(nusrat.status).toBe('MATCHED');
    });

    it('cancels the pool when its last member leaves', async () => {
      const nusrat = await book(cast.nusrat, 'MOHAKHALI');
      const accepted = await as(app, cast.jashim)
        .patch(`/ride-requests/${nusrat.request.id}/accept`)
        .expect(200);

      await as(app, cast.nusrat).patch(`/ride-requests/${nusrat.request.id}/cancel`).expect(200);

      const pool = await prisma.pool.findUniqueOrThrow({ where: { id: accepted.body.id } });
      expect(pool.status).toBe('CANCELLED');
      expect(pool.occupiedSeats).toBe(0);
    });

    it('cancels a request that is still waiting', async () => {
      const shirin = await book(cast.shirin, 'FARMGATE');
      const res = await as(app, cast.shirin)
        .patch(`/ride-requests/${shirin.request.id}/cancel`)
        .expect(200);
      expect(res.body.request.status).toBe('CANCELLED');
    });
  });

  describe('fares', () => {
    it("Nusrat's estimate is 9000 alone, and her final fare is 7200 once Rafiq shared", async () => {
      const { poolId, nusratBooking, acceptedPool, rafiqBooking } = await nusratAndRafiqPool();

      // Alone: solo estimate, both while waiting and once the pool is created for her.
      expect(nusratBooking.estimatedFarePoysha).toBe(9000);
      expect(acceptedPool.members[0].farePoysha).toBe(9000);
      // Rafiq joins a shared pool, so his estimate already has the discount.
      expect(rafiqBooking.estimatedFarePoysha).toBe(6880);

      const completed = await runTrip(poolId);
      const fareOf = (name: string) =>
        completed.members.find((m: { passengerName: string }) => m.passengerName === name).farePoysha;
      expect(fareOf('Nusrat')).toBe(7200);
      expect(fareOf('Rafiq')).toBe(6880);
    });
  });

  describe('payments', () => {
    it('rejects paying the same ride twice', async () => {
      const { poolId } = await nusratAndRafiqPool();
      const completed = await runTrip(poolId);
      const nusrat = as(app, cast.nusrat);
      const nusratMembership = membershipId(completed, 'Nusrat');

      const paid = await nusrat
        .post(`/payments/${nusratMembership}`, { method: 'WALLET' })
        .expect(201);
      expect(paid.body.walletBalancePoysha).toBe(50000 - 7200);

      expectError(
        await nusrat.post(`/payments/${nusratMembership}`, { method: 'CASH' }),
        409,
        'ALREADY_PAID',
      );
      const debits = await prisma.walletTransaction.count({ where: { type: 'DEBIT' } });
      expect(debits).toBe(1);
    });

    it('rejects a wallet payment the balance cannot cover, and rolls it back', async () => {
      const { poolId } = await nusratAndRafiqPool();
      const completed = await runTrip(poolId);
      const rafiqMembership = membershipId(completed, 'Rafiq');
      // Test-only shortcut: drain the balance directly (the ledger no longer adds up, which
      // doesn't matter for this check).
      await prisma.wallet.update({
        where: { userId: cast.rafiq.id },
        data: { balancePoysha: 100 },
      });

      const rafiq = as(app, cast.rafiq);
      expectError(
        await rafiq.post(`/payments/${rafiqMembership}`, { method: 'WALLET' }),
        422,
        'INSUFFICIENT_FUNDS',
      );

      // Nothing half-written: still unpaid, balance unchanged, so cash still works.
      const membership = await prisma.poolMembership.findUniqueOrThrow({
        where: { id: rafiqMembership },
      });
      expect(membership.paidAt).toBeNull();
      const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: cast.rafiq.id } });
      expect(wallet.balancePoysha).toBe(100);
      await rafiq.post(`/payments/${rafiqMembership}`, { method: 'CASH' }).expect(201);
    });
  });
});
