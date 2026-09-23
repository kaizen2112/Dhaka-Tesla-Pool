import { RideStatus } from '@prisma/client';

// "Active pool" per docs/ARCHITECTURE.md §3 — matches the pool_one_active_per_vehicle index.
export const ACTIVE_POOL_STATUSES: RideStatus[] = ['MATCHED', 'DRIVER_ARRIVED', 'STARTED'];
