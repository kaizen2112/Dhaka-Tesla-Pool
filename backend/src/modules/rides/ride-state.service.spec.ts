import { RideStatus } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';
import { RideStateService } from './ride-state.service';

type Kind = 'request' | 'pool';

// Written out by hand from docs/ARCHITECTURE.md §3, not derived from the service's own
// tables, so a typo in the service can't make its own test pass.
const LEGAL: [Kind, RideStatus, RideStatus][] = [
  ['request', 'REQUESTED', 'MATCHED'],
  ['request', 'REQUESTED', 'CANCELLED'],
  ['request', 'MATCHED', 'DRIVER_ARRIVED'],
  ['request', 'MATCHED', 'CANCELLED'],
  ['request', 'DRIVER_ARRIVED', 'STARTED'],
  ['request', 'DRIVER_ARRIVED', 'CANCELLED'],
  ['request', 'STARTED', 'COMPLETED'],
  ['pool', 'MATCHED', 'DRIVER_ARRIVED'],
  ['pool', 'MATCHED', 'CANCELLED'],
  ['pool', 'DRIVER_ARRIVED', 'STARTED'],
  ['pool', 'DRIVER_ARRIVED', 'CANCELLED'],
  ['pool', 'STARTED', 'COMPLETED'],
];

const ALL: RideStatus[] = [
  'REQUESTED',
  'MATCHED',
  'DRIVER_ARRIVED',
  'STARTED',
  'COMPLETED',
  'CANCELLED',
];

const ILLEGAL: [Kind, RideStatus, RideStatus][] = [
  // no cancelling once the trip has started
  ['request', 'STARTED', 'CANCELLED'],
  ['pool', 'STARTED', 'CANCELLED'],
  // skipping a step
  ['request', 'REQUESTED', 'STARTED'],
  ['request', 'MATCHED', 'STARTED'],
  ['pool', 'MATCHED', 'COMPLETED'],
  // same state is not a transition
  ['pool', 'MATCHED', 'MATCHED'],
  // terminal states
  ...ALL.map((to): [Kind, RideStatus, RideStatus] => ['request', 'COMPLETED', to]),
  ...ALL.map((to): [Kind, RideStatus, RideStatus] => ['pool', 'COMPLETED', to]),
  ...ALL.map((to): [Kind, RideStatus, RideStatus] => ['request', 'CANCELLED', to]),
  // a pool is never REQUESTED
  ...ALL.map((to): [Kind, RideStatus, RideStatus] => ['pool', 'REQUESTED', to]),
];

describe('RideStateService', () => {
  const service = new RideStateService();

  it.each(LEGAL)('%s %s → %s is allowed', (kind, from, to) => {
    expect(() => service.assertTransition(kind, from, to)).not.toThrow();
  });

  it.each(ILLEGAL)('%s %s → %s is rejected', (kind, from, to) => {
    expect(() => service.assertTransition(kind, from, to)).toThrow(DomainException);
  });

  it('rejects with 409 INVALID_TRANSITION', () => {
    expect.assertions(3);
    try {
      service.assertTransition('request', 'STARTED', 'CANCELLED');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainException);
      expect((error as DomainException).code).toBe('INVALID_TRANSITION');
      expect((error as DomainException).getStatus()).toBe(409);
    }
  });
});
