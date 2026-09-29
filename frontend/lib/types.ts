// Mirrors the backend responses in docs/API_SPEC.md. Dates arrive as ISO strings; money is
// always integer poysha.

export type Role = "PASSENGER" | "DRIVER" | "ADMIN";

export type RideStatus =
  | "REQUESTED"
  | "MATCHED"
  | "DRIVER_ARRIVED"
  | "STARTED"
  | "COMPLETED"
  | "CANCELLED";

export type PaymentMethod = "CASH" | "WALLET";

export type ComplaintCategory =
  | "DANGEROUS_DRIVING"
  | "RUDE_BEHAVIOUR"
  | "VEHICLE_CONDITION"
  | "ROUTE_OR_FARE"
  | "SAFETY"
  | "OTHER";

export type ComplaintStatus = "OPEN" | "RESOLVED" | "DISMISSED";

// A passenger's own feedback on one booking (docs/API_SPEC.md → Feedback). One of each, at most.
export interface MembershipFeedback {
  rating: { stars: number; comment: string | null } | null;
  complaint: { category: ComplaintCategory; status: ComplaintStatus; resolutionNote: string | null } | null;
}

// average is null until someone rates (not 0, which would read as "terrible").
export interface DriverRating {
  average: number | null;
  count: number;
}

export type WaitReason =
  | "NO_OPEN_POOLS"
  | "CAPACITY_EXCEEDED"
  | "PICKUP_TOO_FAR"
  | "EXTRA_DISTANCE_TOO_HIGH";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

// POST /auth/register, POST /auth/login
export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface RideRequest {
  id: string;
  pickupZone: string;
  destinationZone: string;
  seats: number;
  status: RideStatus;
  createdAt: string;
}

export interface Membership {
  id: string;
  seats: number;
  farePoysha: number;
  cancelledAt: string | null;
  paymentMethod: PaymentMethod | null;
  paidAt: string | null;
}

// POST /ride-requests (201)
export interface CreateRideResponse {
  request: RideRequest;
  pool: {
    id: string;
    status: RideStatus;
    vehicleName: string;
    capacity: number;
    occupiedSeats: number;
  } | null;
  estimatedFarePoysha: number;
  matchResult: { matched: true; score: number } | { matched: false; reason: WaitReason };
}

// GET /ride-requests/me — newest first
export interface MyRideRequest extends RideRequest {
  passengerId: string;
  updatedAt: string;
  membership: (Membership & MembershipFeedback & { poolId: string }) | null;
}

// GET /ride-requests/:id and PATCH /ride-requests/:id/cancel
export interface RideRequestDetail {
  // Only while REQUESTED. reason null = an open pool fits; waiting for its driver to accept.
  waiting: { estimatedFarePoysha: number; reason: WaitReason | null } | null;
  request: RideRequest;
  membership: (Membership & MembershipFeedback) | null;
  pool: {
    id: string;
    status: RideStatus;
    vehicleName: string;
    driverName: string;
    driverRating: DriverRating;
    capacity: number;
    occupiedSeats: number;
    coRiders: string[];
  } | null;
}

// GET /ride-requests/pending — oldest first
export interface PendingRequest {
  id: string;
  passengerName: string;
  pickupZone: string;
  destinationZone: string;
  seats: number;
  createdAt: string;
}

// GET /pools/:id as the pool's driver; also PATCH /ride-requests/:id/accept and pool transitions
export interface DriverPool {
  id: string;
  status: RideStatus;
  vehicleName: string;
  pickupZone: string;
  destinationZone: string;
  capacity: number;
  occupiedSeats: number;
  members: {
    membershipId: string;
    rideRequestId: string;
    passengerName: string;
    pickupZone: string;
    destinationZone: string;
    seats: number;
    farePoysha: number;
    extraKm: number; // km ridden beyond their direct trip
  }[];
  stops: (RouteStop & { riders: { membershipId: string; passengerName: string }[] })[];
}

// The order the Tesla visits zones (docs/API_SPEC.md → Route stops).
export interface RouteStop {
  order: number;
  zone: string;
  type: "PICKUP" | "DROPOFF";
}

// GET /pools/:id as a member passenger
export interface PassengerPool {
  id: string;
  status: RideStatus;
  vehicleName: string;
  driverName: string;
  driverRating: DriverRating;
  capacity: number;
  occupiedSeats: number;
  coRiders: string[];
  myMembership: Membership & { rideRequestId: string; extraKm: number | null };
  stops: (RouteStop & { mine: boolean })[]; // co-riders' stops, but not their names
}

// GET /pools/:id/history — oldest first
export interface HistoryEntry {
  id: string;
  rideRequestId: string | null;
  fromStatus: RideStatus | null;
  toStatus: RideStatus;
  changedAt: string;
  actor: { name: string };
}

// GET /pools/:id/fares
export interface PoolFares {
  poolStatus: RideStatus;
  final: boolean;
  fares: {
    membershipId: string;
    passengerName: string;
    pickupZone: string;
    destinationZone: string;
    farePoysha: number; // stored: the estimate at join, then the final fare at COMPLETED
    breakdown: FareBreakdown; // recomputed now for the pool's current members
  }[];
}

// Totals for all `seats`: basePoysha + distanceChargePoysha − discountPoysha = farePoysha.
export interface FareBreakdown {
  pricingKm: number;
  seats: number;
  basePoysha: number;
  distanceChargePoysha: number;
  discountPoysha: number;
  farePoysha: number;
}

// GET /vehicles/me, PATCH /vehicles/me/status
export interface Vehicle {
  id: string;
  driverId: string;
  name: string;
  capacity: number;
  isOnline: boolean;
}

export interface MyVehicle extends Vehicle {
  activePool: {
    id: string;
    status: RideStatus;
    capacity: number;
    occupiedSeats: number;
    pickupZone: string;
    destinationZone: string;
  } | null;
}

// POST /payments/:poolMembershipId
export interface PaymentResult {
  membershipId: string;
  farePoysha: number;
  paymentMethod: PaymentMethod;
  paidAt: string;
  walletBalancePoysha: number | null;
}

// GET /wallet/me
export interface Wallet {
  balancePoysha: number;
  transactions: {
    id: string;
    type: "CREDIT" | "DEBIT";
    amountPoysha: number;
    poolMembershipId: string | null;
    createdAt: string;
  }[];
}

// GET /pools/me — the driver's trips, newest first (max 20); includes cancelled bookings.
// GET /admin/pools — the same shape, every driver's (max 50).
export interface DriverTrip {
  id: string;
  status: RideStatus;
  vehicleName: string;
  driverName: string;
  pickupZone: string;
  destinationZone: string;
  capacity: number;
  occupiedSeats: number;
  createdAt: string;
  members: {
    membershipId: string;
    passengerName: string;
    pickupZone: string;
    destinationZone: string;
    seats: number;
    farePoysha: number;
    paymentMethod: PaymentMethod | null;
    paidAt: string | null;
    cancelledAt: string | null;
  }[];
}

// GET /fares/estimate — the solo quote before booking
export interface FareEstimate {
  directKm: number;
  breakdown: FareBreakdown;
}

// GET /drivers/me/profile — anonymous: no passenger names or ids anywhere.
export interface DriverProfile {
  driver: { name: string; vehicleName: string | null };
  rating: DriverRating & { distribution: Record<1 | 2 | 3 | 4 | 5, number> };
  reviews: { id: string; stars: number; comment: string | null; createdAt: string }[]; // latest 20
  complaints: {
    id: string;
    category: ComplaintCategory;
    description: string;
    status: ComplaintStatus;
    resolutionNote: string | null;
    createdAt: string;
    resolvedAt: string | null;
  }[];
}

// GET /admin/overview
export interface AdminOverview {
  users: { passengers: number; drivers: number };
  driversOnline: number;
  activePools: number;
  tripsCompletedToday: number; // since midnight in Dhaka
  collectedPoysha: number;
  openComplaints: number;
}

// GET /admin/users — extra fields depend on the role
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  vehicle?: { name: string; capacity: number; isOnline: boolean } | null; // drivers
  rating?: DriverRating; // drivers
  openComplaints?: number; // drivers
  walletBalancePoysha?: number; // passengers
  rides?: number; // passengers
}

// GET /admin/complaints — the admin sees who reported whom
export interface AdminComplaint {
  id: string;
  category: ComplaintCategory;
  description: string;
  status: ComplaintStatus;
  createdAt: string;
  passengerName: string;
  driverName: string;
  trip: { poolId: string; pickupZone: string; destinationZone: string; date: string };
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
}
