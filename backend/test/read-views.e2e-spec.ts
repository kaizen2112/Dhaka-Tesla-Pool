import { INestApplication } from '@nestjs/common';
import { User } from '@prisma/client';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { as, Cast, createCast, resetDb, startApp } from './support';

// The read-only views the UI builds on (docs/UI_UX_PLAN.md §5): fare quotes, why a request
// waits, the route stops, and the driver's trip list. None of them may change any state.
describe('Read views', () => {
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

  async function book(user: User, destinationZone: string) {
    const res = await as(app, user)
      .post('/ride-requests', { pickupZone: 'BANANI', destinationZone, seats: 1 })
      .expect(201);
    return res.body.request.id as string;
  }

  // Nusrat books and waits, Jashim accepts (creating the pool), Rafiq auto-joins.
  async function nusratAndRafiqPool() {
    const nusratRequestId = await book(cast.nusrat, 'MOHAKHALI');
    const accepted = await as(app, cast.jashim)
      .patch(`/ride-requests/${nusratRequestId}/accept`)
      .expect(200);
    await book(cast.rafiq, 'GULSHAN_1');
    return { poolId: accepted.body.id as string, nusratRequestId };
  }

  describe('GET /fares/estimate', () => {
    const estimate = (user: User, query: string) =>
      as(app, user).get(`/fares/estimate?${query}`);

    it("quotes Nusrat's solo Banani → Mohakhali fare: 9000 poysha, 1.972 km", async () => {
      const res = await estimate(cast.nusrat, 'pickupZone=BANANI&destinationZone=MOHAKHALI&seats=1')
        .expect(200);
      expect(res.body.directKm).toBeCloseTo(1.972, 3);
      expect(res.body.breakdown).toMatchObject({ pricingKm: 2, farePoysha: 9000, discountPoysha: 0 });
    });

    it('prices every seat', async () => {
      const res = await estimate(cast.nusrat, 'pickupZone=BANANI&destinationZone=MOHAKHALI&seats=2')
        .expect(200);
      expect(res.body.breakdown.farePoysha).toBe(18000);
    });

    it.each([
      ['same pickup and destination', 'pickupZone=BANANI&destinationZone=BANANI&seats=1'],
      ['an unknown zone', 'pickupZone=BANANI&destinationZone=NARNIA&seats=1'],
      ['0 seats', 'pickupZone=BANANI&destinationZone=MOHAKHALI&seats=0'],
      ['8 seats', 'pickupZone=BANANI&destinationZone=MOHAKHALI&seats=8'],
      ['non-numeric seats', 'pickupZone=BANANI&destinationZone=MOHAKHALI&seats=two'],
      ['a missing field', 'pickupZone=BANANI&seats=1'],
    ])('rejects %s', async (_name, query) => {
      const res = await estimate(cast.nusrat, query);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('is for passengers only', async () => {
      const res = await estimate(cast.jashim, 'pickupZone=BANANI&destinationZone=MOHAKHALI&seats=1');
      expect(res.status).toBe(403);
    });
  });

  describe('waiting info on GET /ride-requests/:id', () => {
    it('explains a wait while REQUESTED and disappears once MATCHED', async () => {
      const nusratRequestId = await book(cast.nusrat, 'MOHAKHALI');
      const nusrat = as(app, cast.nusrat);

      const waiting = await nusrat.get(`/ride-requests/${nusratRequestId}`).expect(200);
      expect(waiting.body.waiting).toEqual({ estimatedFarePoysha: 9000, reason: 'NO_OPEN_POOLS' });

      await as(app, cast.jashim).patch(`/ride-requests/${nusratRequestId}/accept`).expect(200);
      const matched = await nusrat.get(`/ride-requests/${nusratRequestId}`).expect(200);
      expect(matched.body.request.status).toBe('MATCHED');
      expect(matched.body.waiting).toBeNull();
    });

    it('gives the real rejection, and only reads', async () => {
      await nusratAndRafiqPool();
      // Banani → Uttara points the other way from the pool's route (ARCHITECTURE §6).
      const shirinRequestId = await book(cast.shirin, 'UTTARA');

      const res = await as(app, cast.shirin).get(`/ride-requests/${shirinRequestId}`).expect(200);
      expect(res.body.waiting.reason).toBe('EXTRA_DISTANCE_TOO_HIGH');

      const request = await prisma.rideRequest.findUniqueOrThrow({ where: { id: shirinRequestId } });
      expect(request.status).toBe('REQUESTED');
      expect(await prisma.poolMembership.count({ where: { rideRequestId: shirinRequestId } })).toBe(0);
    });
  });

  describe('route stops on GET /pools/:id', () => {
    it('gives the driver every stop with names, and each passenger their extra km', async () => {
      const { poolId } = await nusratAndRafiqPool();
      const res = await as(app, cast.jashim).get(`/pools/${poolId}`).expect(200);

      expect(res.body.stops.map((s: { zone: string; type: string }) => `${s.type} ${s.zone}`)).toEqual([
        'PICKUP BANANI',
        'DROPOFF GULSHAN_1',
        'DROPOFF MOHAKHALI',
      ]);
      expect(
        res.body.stops[0].riders.map((r: { passengerName: string }) => r.passengerName),
      ).toEqual(['Nusrat', 'Rafiq']);

      const extra = (name: string) =>
        res.body.members.find((m: { passengerName: string }) => m.passengerName === name).extraKm;
      expect(extra('Nusrat')).toBeCloseTo(1.632, 2);
      expect(extra('Rafiq')).toBe(0);
    });

    it("shows a passenger which stops are theirs, without naming co-riders", async () => {
      const { poolId } = await nusratAndRafiqPool();
      const res = await as(app, cast.nusrat).get(`/pools/${poolId}`).expect(200);

      expect(res.body.stops).toEqual([
        { order: 1, zone: 'BANANI', type: 'PICKUP', mine: true },
        { order: 2, zone: 'GULSHAN_1', type: 'DROPOFF', mine: false },
        { order: 3, zone: 'MOHAKHALI', type: 'DROPOFF', mine: true },
      ]);
      expect(JSON.stringify(res.body.stops)).not.toContain('Rafiq');
      expect(res.body.myMembership.extraKm).toBeCloseTo(1.632, 2);
    });
  });

  describe('GET /pools/me', () => {
    it("lists Jashim's trips, and never shows them to Karim", async () => {
      const { poolId } = await nusratAndRafiqPool();

      const jashim = await as(app, cast.jashim).get('/pools/me').expect(200);
      expect(jashim.body).toHaveLength(1);
      expect(jashim.body[0].id).toBe(poolId);
      expect(
        jashim.body[0].members.map((m: { passengerName: string }) => m.passengerName),
      ).toEqual(['Nusrat', 'Rafiq']);

      const karim = await as(app, cast.karim).get('/pools/me').expect(200);
      expect(karim.body).toEqual([]);
    });

    it('keeps a cancelled booking in the history', async () => {
      const { poolId, nusratRequestId } = await nusratAndRafiqPool();
      await as(app, cast.nusrat).patch(`/ride-requests/${nusratRequestId}/cancel`).expect(200);

      const res = await as(app, cast.jashim).get('/pools/me').expect(200);
      const nusrat = res.body[0].members.find((m: { passengerName: string }) => m.passengerName === 'Nusrat');
      expect(res.body[0].id).toBe(poolId);
      expect(nusrat.cancelledAt).not.toBeNull();
    });

    it('is for drivers only', async () => {
      const res = await as(app, cast.nusrat).get('/pools/me');
      expect(res.status).toBe(403);
    });
  });
});
