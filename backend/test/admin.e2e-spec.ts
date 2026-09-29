import { INestApplication } from '@nestjs/common';
import { User } from '@prisma/client';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { as, Cast, createCast, resetDb, startApp } from './support';

// The admin API (docs/API_SPEC.md → Admin): Tania reads everything and decides complaints;
// nobody else gets in.
describe('Admin', () => {
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
    return res.body.request.id as string;
  }

  type DriverPool = { id: string; members: { passengerName: string; membershipId: string }[] };
  const membershipOf = (pool: DriverPool, name: string) =>
    pool.members.find((m) => m.passengerName === name)!.membershipId;

  // The 8:41 story: Nusrat, Rafiq and Shirin share Bullet; returns the pool before it moves.
  async function storyPool() {
    const nusratRequest = await book(cast.nusrat, 'MOHAKHALI');
    const accepted = await as(app, cast.jashim).patch(`/ride-requests/${nusratRequest}/accept`).expect(200);
    await book(cast.rafiq, 'GULSHAN_1');
    const shirinRequest = await book(cast.shirin, 'FARMGATE');
    return { poolId: accepted.body.id as string, shirinRequest };
  }

  async function runTrip(poolId: string) {
    const jashim = as(app, cast.jashim);
    await jashim.patch(`/pools/${poolId}/arrived`).expect(200);
    await jashim.patch(`/pools/${poolId}/start`).expect(200);
    const completed = await jashim.patch(`/pools/${poolId}/complete`).expect(200);
    return completed.body as DriverPool;
  }

  // After the trip: Nusrat pays by wallet, Rafiq in cash, Shirin not yet; Shirin reports Jashim.
  async function afterTheStory() {
    const { poolId, shirinRequest } = await storyPool();
    const completed = await runTrip(poolId);
    await as(app, cast.nusrat).post(`/payments/${membershipOf(completed, 'Nusrat')}`, { method: 'WALLET' }).expect(201);
    await as(app, cast.rafiq).post(`/payments/${membershipOf(completed, 'Rafiq')}`, { method: 'CASH' }).expect(201);
    await as(app, cast.nusrat).post(`/ratings/${membershipOf(completed, 'Nusrat')}`, { stars: 5 }).expect(201);
    const complaint = await as(app, cast.shirin)
      .post(`/complaints/${membershipOf(completed, 'Shirin')}`, {
        category: 'DANGEROUS_DRIVING',
        description: 'Ran a red light at Mohakhali',
      })
      .expect(201);
    return { poolId, shirinRequest, complaintId: complaint.body.id as string };
  }

  describe('access', () => {
    // Every row has all 3 values: with fewer values than parameters, Jest treats the extra
    // parameter as a `done` callback and waits for it until the test times out.
    const routes: [string, string, object][] = [
      ['get', '/admin/overview', {}],
      ['get', '/admin/users', {}],
      ['get', '/admin/pools', {}],
      ['get', '/admin/complaints', {}],
      ['patch', '/admin/complaints/00000000-0000-4000-8000-000000000000', { status: 'RESOLVED', resolutionNote: 'Nope' }],
    ];

    it.each(routes)('%s %s is admin only', async (method, path, body) => {
      for (const user of [cast.nusrat, cast.jashim]) {
        const client = as(app, user);
        const res = method === 'get' ? await client.get(path) : await client.patch(path, body);
        expectError(res, 403, 'FORBIDDEN');
      }
    });
  });

  describe('GET /admin/overview', () => {
    it('counts an active trip while it runs', async () => {
      await storyPool();
      const res = await as(app, cast.tania).get('/admin/overview').expect(200);
      expect(res.body).toMatchObject({ activePools: 1, tripsCompletedToday: 0, collectedPoysha: 0 });
    });

    it('adds up the canonical trip: 1 completed, ৳140.80 collected, 1 open complaint', async () => {
      await afterTheStory();
      const res = await as(app, cast.tania).get('/admin/overview').expect(200);
      expect(res.body).toEqual({
        users: { passengers: 3, drivers: 2 }, // Jashim and the test-only Karim
        driversOnline: 2,
        activePools: 0,
        tripsCompletedToday: 1,
        collectedPoysha: 7200 + 6880, // Shirin hasn't paid
        openComplaints: 1,
      });
    });
  });

  describe('GET /admin/users', () => {
    it("shows drivers with their rating and open complaints, passengers with wallet and rides", async () => {
      await afterTheStory();
      const tania = as(app, cast.tania);

      const drivers = await tania.get('/admin/users?role=DRIVER').expect(200);
      const jashim = drivers.body.find((u: { name: string }) => u.name === 'Jashim');
      expect(jashim).toMatchObject({
        role: 'DRIVER',
        vehicle: { name: 'Bullet', capacity: 3, isOnline: true },
        rating: { average: 5, count: 1 },
        openComplaints: 1,
      });
      expect(drivers.body.find((u: { name: string }) => u.name === 'Karim'))
        .toMatchObject({ rating: { average: null, count: 0 }, openComplaints: 0 });
      expect(drivers.body.every((u: { role: string }) => u.role === 'DRIVER')).toBe(true);

      const passengers = await tania.get('/admin/users?role=PASSENGER').expect(200);
      expect(passengers.body.find((u: { name: string }) => u.name === 'Nusrat'))
        .toMatchObject({ walletBalancePoysha: 50000 - 7200, rides: 1 });

      const everyone = await tania.get('/admin/users').expect(200);
      expect(everyone.body).toHaveLength(6); // 3 passengers, 2 drivers, Tania
      expect(JSON.stringify(everyone.body)).not.toContain('passwordHash');
    });

    it('rejects an unknown role', async () => {
      expectError(await as(app, cast.tania).get('/admin/users?role=PILOT'), 400, 'VALIDATION_ERROR');
    });
  });

  describe('GET /admin/pools', () => {
    it("lists every driver's trips with the driver's name and each passenger", async () => {
      const { poolId } = await storyPool();
      const res = await as(app, cast.tania).get('/admin/pools').expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ id: poolId, driverName: 'Jashim', vehicleName: 'Bullet', occupiedSeats: 3 });
      expect(res.body[0].members.map((m: { passengerName: string }) => m.passengerName))
        .toEqual(['Nusrat', 'Rafiq', 'Shirin']);
    });
  });

  describe('complaints', () => {
    it('Tania sees who reported whom, resolves it, and Shirin sees the note', async () => {
      const { complaintId, shirinRequest, poolId } = await afterTheStory();
      const tania = as(app, cast.tania);

      const open = await tania.get('/admin/complaints?status=OPEN').expect(200);
      expect(open.body).toHaveLength(1);
      expect(open.body[0]).toMatchObject({
        id: complaintId,
        passengerName: 'Shirin',
        driverName: 'Jashim',
        category: 'DANGEROUS_DRIVING',
        trip: { poolId, pickupZone: 'BANANI', destinationZone: 'FARMGATE' },
        resolvedBy: null,
      });

      const decided = await tania
        .patch(`/admin/complaints/${complaintId}`, { status: 'RESOLVED', resolutionNote: 'Spoke to Jashim, warning issued' })
        .expect(200);
      expect(decided.body).toMatchObject({ status: 'RESOLVED', resolvedBy: { name: 'Tania' } });

      expect((await tania.get('/admin/complaints?status=OPEN').expect(200)).body).toEqual([]);
      const resolved = await tania.get('/admin/complaints?status=RESOLVED').expect(200);
      expect(resolved.body[0]).toMatchObject({ resolvedBy: 'Tania', resolutionNote: 'Spoke to Jashim, warning issued' });

      const ride = await as(app, cast.shirin).get(`/ride-requests/${shirinRequest}`).expect(200);
      expect(ride.body.membership.complaint).toMatchObject({ status: 'RESOLVED', resolutionNote: 'Spoke to Jashim, warning issued' });
    });

    it('decides a complaint only once', async () => {
      const { complaintId } = await afterTheStory();
      const tania = as(app, cast.tania);
      await tania
        .patch(`/admin/complaints/${complaintId}`, { status: 'DISMISSED', resolutionNote: 'Dashcam shows a green light' })
        .expect(200);
      expectError(
        await tania.patch(`/admin/complaints/${complaintId}`, { status: 'RESOLVED', resolutionNote: 'Second opinion' }),
        409,
        'INVALID_TRANSITION',
      );
    });

    it('404s for a complaint that does not exist', async () => {
      const res = await as(app, cast.tania).patch('/admin/complaints/00000000-0000-4000-8000-000000000000', {
        status: 'RESOLVED',
        resolutionNote: 'Nothing here',
      });
      expectError(res, 404, 'NOT_FOUND');
    });

    it.each([
      ['moving it back to OPEN', { status: 'OPEN', resolutionNote: 'Reopening this one' }],
      ['no note', { status: 'RESOLVED' }],
      ['a blank note', { status: 'RESOLVED', resolutionNote: '        ' }],
    ])('rejects %s', async (_name, body) => {
      const { complaintId } = await afterTheStory();
      expectError(await as(app, cast.tania).patch(`/admin/complaints/${complaintId}`, body), 400, 'VALIDATION_ERROR');
    });
  });
});
