import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer, createCast, resetDb, startApp } from './support';

// The brief's concurrency problem (docs/ARCHITECTURE.md §8): Bullet has 1 seat left, and
// Nusrat and Shirin both try to claim it at the same instant. Runs against real Postgres, so
// the row lock is actually exercised — a mocked Prisma would prove nothing here.
describe("Bullet's last seat", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await startApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  // Repeated because a race that loses only sometimes is exactly the bug we're hunting.
  const RUNS = Array.from({ length: 10 }, (_, i) => i + 1);

  it.each(RUNS)('run %i: Nusrat and Shirin race for it, exactly one wins', async () => {
    await resetDb(prisma);
    const { jashim, nusrat, rafiq, shirin } = await createCast(prisma);
    const server = app.getHttpServer();

    // Fixture (docs/DATABASE.md → Concurrency test fixture): Rafiq holds 2 of Bullet's 3 seats.
    const rafiqRequest = await request(server)
      .post('/ride-requests')
      .set('Authorization', bearer(app, rafiq))
      .send({ pickupZone: 'BANANI', destinationZone: 'GULSHAN_1', seats: 2 })
      .expect(201);
    const pool = await request(server)
      .patch(`/ride-requests/${rafiqRequest.body.request.id}/accept`)
      .set('Authorization', bearer(app, jashim))
      .expect(200);
    expect(pool.body.occupiedSeats).toBe(2);

    // Either one alone would match (worst extra 1.63 km / 1.20 km), so capacity is the only
    // reason one of them can lose.
    const [nusratRes, shirinRes] = await Promise.all([
      request(server)
        .post('/ride-requests')
        .set('Authorization', bearer(app, nusrat))
        .send({ pickupZone: 'BANANI', destinationZone: 'MOHAKHALI', seats: 1 }),
      request(server)
        .post('/ride-requests')
        .set('Authorization', bearer(app, shirin))
        .send({ pickupZone: 'BANANI', destinationZone: 'FARMGATE', seats: 1 }),
    ]);
    expect(nusratRes.status).toBe(201);
    expect(shirinRes.status).toBe(201);

    const results = [nusratRes.body, shirinRes.body];
    const winners = results.filter((r) => r.request.status === 'MATCHED');
    const losers = results.filter((r) => r.request.status === 'REQUESTED');
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0].matchResult).toEqual({ matched: false, reason: 'CAPACITY_EXCEEDED' });

    // Check the database itself, not just the API responses.
    const dbPool = await prisma.pool.findUniqueOrThrow({
      where: { id: pool.body.id },
      include: { memberships: { where: { cancelledAt: null } } },
    });
    expect(dbPool.occupiedSeats).toBe(3);
    expect(dbPool.memberships.reduce((sum, m) => sum + m.seats, 0)).toBe(3);
  });
});
