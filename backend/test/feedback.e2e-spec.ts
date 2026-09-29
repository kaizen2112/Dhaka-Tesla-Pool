import { INestApplication, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { App } from 'supertest/types';
import { FeedbackService } from '../src/modules/feedback/feedback.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { as, Cast, createCast, resetDb, startApp } from './support';

// Ratings and complaints (docs/ADMIN_FEEDBACK_PLAN.md §7): who may leave them, when, how often,
// and that the driver never learns who wrote them.
describe('Feedback', () => {
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

  // The 8:41 story up to Jashim accepting and Rafiq auto-joining; returns the driver's pool view.
  async function nusratAndRafiqPool() {
    const requests = { nusrat: await book(cast.nusrat, 'MOHAKHALI') } as Record<string, string>;
    const accepted = await as(app, cast.jashim)
      .patch(`/ride-requests/${requests.nusrat}/accept`)
      .expect(200);
    requests.rafiq = await book(cast.rafiq, 'GULSHAN_1');
    return { pool: accepted.body as DriverPool, requests };
  }

  async function runTrip(poolId: string) {
    const jashim = as(app, cast.jashim);
    await jashim.patch(`/pools/${poolId}/arrived`).expect(200);
    await jashim.patch(`/pools/${poolId}/start`).expect(200);
    const completed = await jashim.patch(`/pools/${poolId}/complete`).expect(200);
    return completed.body as DriverPool;
  }

  // Nusrat, Rafiq and Shirin share Bullet and the trip completes.
  async function completedStoryTrip() {
    const { pool, requests } = await nusratAndRafiqPool();
    requests.shirin = await book(cast.shirin, 'FARMGATE');
    const completed = await runTrip(pool.id);
    return { completed, requests };
  }

  describe('ratings', () => {
    it('Nusrat and Rafiq rate Jashim; his profile shows 4.5 from 2, without their names', async () => {
      const { completed } = await completedStoryTrip();
      const rated = await as(app, cast.nusrat)
        .post(`/ratings/${membershipOf(completed, 'Nusrat')}`, { stars: 5, comment: 'Smooth ride' })
        .expect(201);
      expect(rated.body).toMatchObject({ stars: 5, comment: 'Smooth ride' });
      await as(app, cast.rafiq).post(`/ratings/${membershipOf(completed, 'Rafiq')}`, { stars: 4 }).expect(201);

      const profile = await as(app, cast.jashim).get('/drivers/me/profile').expect(200);
      expect(profile.body.driver).toEqual({ name: 'Jashim', vehicleName: 'Bullet' });
      expect(profile.body.rating).toEqual({
        average: 4.5,
        count: 2,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
      });
      expect(profile.body.reviews.map((r: { stars: number }) => r.stars).sort()).toEqual([4, 5]);

      // Anonymous: neither the names nor the passenger ids appear anywhere in the response.
      const raw = JSON.stringify(profile.body);
      for (const p of [cast.nusrat, cast.rafiq]) {
        expect(raw).not.toContain(p.name);
        expect(raw).not.toContain(p.id);
      }
    });

    it("shows on Nusrat's ride: her own rating, and the driver's average", async () => {
      const { completed, requests } = await completedStoryTrip();
      const nusrat = as(app, cast.nusrat);
      await nusrat.post(`/ratings/${membershipOf(completed, 'Nusrat')}`, { stars: 5, comment: 'Smooth ride' }).expect(201);

      const ride = await nusrat.get(`/ride-requests/${requests.nusrat}`).expect(200);
      expect(ride.body.membership.rating).toEqual({ stars: 5, comment: 'Smooth ride' });
      expect(ride.body.membership.complaint).toBeNull();
      expect(ride.body.pool.driverRating).toEqual({ average: 5, count: 1 });

      const history = await nusrat.get('/ride-requests/me').expect(200);
      expect(history.body[0].membership.rating).toEqual({ stars: 5, comment: 'Smooth ride' });

      const poolView = await nusrat.get(`/pools/${completed.id}`).expect(200);
      expect(poolView.body.driverRating).toEqual({ average: 5, count: 1 });
    });

    it('stores a blank comment as no comment', async () => {
      const { completed } = await completedStoryTrip();
      const res = await as(app, cast.nusrat)
        .post(`/ratings/${membershipOf(completed, 'Nusrat')}`, { stars: 4, comment: '   ' })
        .expect(201);
      expect(res.body.comment).toBeNull();
    });

    it('rejects rating the same trip twice', async () => {
      const { completed } = await completedStoryTrip();
      const nusrat = as(app, cast.nusrat);
      const path = `/ratings/${membershipOf(completed, 'Nusrat')}`;
      await nusrat.post(path, { stars: 5 }).expect(201);
      expectError(await nusrat.post(path, { stars: 1 }), 409, 'ALREADY_RATED');
      expect(await prisma.rating.count()).toBe(1);
    });

    it('rejects rating before the trip is completed', async () => {
      const { pool } = await nusratAndRafiqPool();
      expectError(
        await as(app, cast.nusrat).post(`/ratings/${membershipOf(pool, 'Nusrat')}`, { stars: 5 }),
        409,
        'FEEDBACK_NOT_ALLOWED',
      );
    });

    it('rejects rating a booking that was cancelled before the trip', async () => {
      const { pool } = await nusratAndRafiqPool();
      const shirinRequest = await book(cast.shirin, 'FARMGATE');
      await as(app, cast.shirin).patch(`/ride-requests/${shirinRequest}/cancel`).expect(200);
      await runTrip(pool.id);

      const shirinMembership = await prisma.poolMembership.findFirstOrThrow({
        where: { passengerId: cast.shirin.id },
      });
      expectError(
        await as(app, cast.shirin).post(`/ratings/${shirinMembership.id}`, { stars: 1 }),
        409,
        'FEEDBACK_NOT_ALLOWED',
      );
    });

    it("rejects Rafiq rating or reporting Nusrat's trip", async () => {
      const { completed } = await completedStoryTrip();
      const rafiq = as(app, cast.rafiq);
      const nusratMembership = membershipOf(completed, 'Nusrat');
      expectError(await rafiq.post(`/ratings/${nusratMembership}`, { stars: 1 }), 403, 'FORBIDDEN');
      expectError(
        await rafiq.post(`/complaints/${nusratMembership}`, { category: 'OTHER', description: 'Not my trip at all' }),
        403,
        'FORBIDDEN',
      );
    });

    it.each([
      ['0 stars', { stars: 0 }],
      ['6 stars', { stars: 6 }],
      ['half a star', { stars: 4.5 }],
      ['no stars', { comment: 'Nice' }],
      ['a 501-character comment', { stars: 5, comment: 'x'.repeat(501) }],
    ])('rejects %s', async (_name, body) => {
      const { completed } = await completedStoryTrip();
      expectError(
        await as(app, cast.nusrat).post(`/ratings/${membershipOf(completed, 'Nusrat')}`, body),
        400,
        'VALIDATION_ERROR',
      );
    });

    it('404s for a booking that does not exist', async () => {
      const res = await as(app, cast.nusrat).post('/ratings/00000000-0000-4000-8000-000000000000', { stars: 5 });
      expectError(res, 404, 'NOT_FOUND');
    });

    it('is for passengers only, and the profile for drivers only', async () => {
      const { completed } = await completedStoryTrip();
      expectError(
        await as(app, cast.jashim).post(`/ratings/${membershipOf(completed, 'Nusrat')}`, { stars: 5 }),
        403,
        'FORBIDDEN',
      );
      expectError(await as(app, cast.nusrat).get('/drivers/me/profile'), 403, 'FORBIDDEN');
    });

    it("Karim's profile has none of Jashim's ratings", async () => {
      const { completed } = await completedStoryTrip();
      await as(app, cast.nusrat).post(`/ratings/${membershipOf(completed, 'Nusrat')}`, { stars: 5 }).expect(201);

      const profile = await as(app, cast.karim).get('/drivers/me/profile').expect(200);
      expect(profile.body.rating).toMatchObject({ average: null, count: 0 });
      expect(profile.body.reviews).toEqual([]);
    });
  });

  describe('complaints', () => {
    const redLight = { category: 'DANGEROUS_DRIVING', description: 'Ran a red light at Mohakhali' };

    it("Shirin reports Jashim; he sees it without her name; Tania resolves it and Shirin sees the note", async () => {
      const { completed, requests } = await completedStoryTrip();
      const shirin = as(app, cast.shirin);

      const filed = await shirin.post(`/complaints/${membershipOf(completed, 'Shirin')}`, redLight).expect(201);
      expect(filed.body).toMatchObject({ ...redLight, status: 'OPEN' });

      const profile = await as(app, cast.jashim).get('/drivers/me/profile').expect(200);
      expect(profile.body.complaints).toHaveLength(1);
      expect(profile.body.complaints[0]).toMatchObject({ ...redLight, status: 'OPEN', resolutionNote: null });
      expect(JSON.stringify(profile.body)).not.toContain('Shirin');
      expect(JSON.stringify(profile.body)).not.toContain(cast.shirin.id);

      // The admin endpoint arrives with the admin API; the service decides the rule now.
      const decided = await app
        .get(FeedbackService)
        .resolveComplaint(cast.tania.id, filed.body.id, 'RESOLVED', 'Spoke to Jashim, warning issued');
      expect(decided).toMatchObject({ status: 'RESOLVED', resolvedBy: { name: 'Tania' } });

      const ride = await shirin.get(`/ride-requests/${requests.shirin}`).expect(200);
      expect(ride.body.membership.complaint).toEqual({
        category: 'DANGEROUS_DRIVING',
        status: 'RESOLVED',
        resolutionNote: 'Spoke to Jashim, warning issued',
      });
    });

    it('decides a complaint only once', async () => {
      const { completed } = await completedStoryTrip();
      const filed = await as(app, cast.shirin)
        .post(`/complaints/${membershipOf(completed, 'Shirin')}`, redLight)
        .expect(201);
      const feedback = app.get(FeedbackService);

      await feedback.resolveComplaint(cast.tania.id, filed.body.id, 'DISMISSED', 'Dashcam shows a green light');
      await expect(
        feedback.resolveComplaint(cast.tania.id, filed.body.id, 'RESOLVED', 'Second opinion'),
      ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
      await expect(
        feedback.resolveComplaint(cast.tania.id, '00000000-0000-4000-8000-000000000000', 'RESOLVED', 'Nothing here'),
      ).rejects.toBeInstanceOf(NotFoundException);

      const stored = await prisma.complaint.findUniqueOrThrow({ where: { id: filed.body.id } });
      expect(stored).toMatchObject({ status: 'DISMISSED', resolutionNote: 'Dashcam shows a green light' });
    });

    it('rejects reporting the same trip twice', async () => {
      const { completed } = await completedStoryTrip();
      const shirin = as(app, cast.shirin);
      const path = `/complaints/${membershipOf(completed, 'Shirin')}`;
      await shirin.post(path, redLight).expect(201);
      expectError(await shirin.post(path, redLight), 409, 'ALREADY_REPORTED');
    });

    it('rejects reporting before the trip is completed', async () => {
      const { pool } = await nusratAndRafiqPool();
      expectError(
        await as(app, cast.nusrat).post(`/complaints/${membershipOf(pool, 'Nusrat')}`, redLight),
        409,
        'FEEDBACK_NOT_ALLOWED',
      );
    });

    it.each([
      ['an unknown category', { category: 'LATE', description: 'Ran a red light at Mohakhali' }],
      ['a description under 10 characters', { category: 'OTHER', description: 'Rude' }],
      ['a description of only spaces', { category: 'OTHER', description: ' '.repeat(20) }],
      ['a 1001-character description', { category: 'OTHER', description: 'x'.repeat(1001) }],
    ])('rejects %s', async (_name, body) => {
      const { completed } = await completedStoryTrip();
      expectError(
        await as(app, cast.shirin).post(`/complaints/${membershipOf(completed, 'Shirin')}`, body),
        400,
        'VALIDATION_ERROR',
      );
    });
  });
});
