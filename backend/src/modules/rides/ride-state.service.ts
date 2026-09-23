import { HttpStatus, Injectable } from '@nestjs/common';
import { RideStatus } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';

type TransitionTable = Record<RideStatus, RideStatus[]>;

// docs/ARCHITECTURE.md §3. Anything not listed here is rejected, never ignored.
const REQUEST_TRANSITIONS: TransitionTable = {
  REQUESTED: ['MATCHED', 'CANCELLED'],
  MATCHED: ['DRIVER_ARRIVED', 'CANCELLED'],
  DRIVER_ARRIVED: ['STARTED', 'CANCELLED'],
  STARTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

// A pool is created at MATCHED (driver accept), so REQUESTED is never a valid pool state.
// Pool → CANCELLED happens only when its last active member cancels.
const POOL_TRANSITIONS: TransitionTable = {
  REQUESTED: [],
  MATCHED: ['DRIVER_ARRIVED', 'CANCELLED'],
  DRIVER_ARRIVED: ['STARTED', 'CANCELLED'],
  STARTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

// Pure — no DB. RidesService calls this before every status write.
@Injectable()
export class RideStateService {
  assertTransition(kind: 'request' | 'pool', from: RideStatus, to: RideStatus): void {
    const table = kind === 'request' ? REQUEST_TRANSITIONS : POOL_TRANSITIONS;
    if (!table[from].includes(to)) {
      throw new DomainException(
        'INVALID_TRANSITION',
        HttpStatus.CONFLICT,
        `Cannot move ${kind} from ${from} to ${to}`,
      );
    }
  }
}
