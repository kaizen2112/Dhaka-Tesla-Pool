-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PASSENGER', 'DRIVER');

-- CreateEnum
CREATE TYPE "RideStatus" AS ENUM ('REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'WALLET');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RideRequest" (
    "id" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "pickupZone" TEXT NOT NULL,
    "destinationZone" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "status" "RideStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RideRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pool" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "pickupZone" TEXT NOT NULL,
    "destinationZone" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "occupiedSeats" INTEGER NOT NULL,
    "status" "RideStatus" NOT NULL DEFAULT 'MATCHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolMembership" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "rideRequestId" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "farePoysha" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "paymentMethod" "PaymentMethod",
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "PoolMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RideStatusHistory" (
    "id" TEXT NOT NULL,
    "poolId" TEXT,
    "rideRequestId" TEXT,
    "fromStatus" "RideStatus",
    "toStatus" "RideStatus" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RideStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balancePoysha" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amountPoysha" INTEGER NOT NULL,
    "poolMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_driverId_key" ON "Vehicle"("driverId");

-- CreateIndex
CREATE INDEX "RideRequest_passengerId_createdAt_idx" ON "RideRequest"("passengerId", "createdAt");

-- CreateIndex
CREATE INDEX "RideRequest_status_idx" ON "RideRequest"("status");

-- CreateIndex
CREATE INDEX "Pool_vehicleId_status_idx" ON "Pool"("vehicleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PoolMembership_rideRequestId_key" ON "PoolMembership"("rideRequestId");

-- CreateIndex
CREATE INDEX "PoolMembership_poolId_idx" ON "PoolMembership"("poolId");

-- CreateIndex
CREATE INDEX "RideStatusHistory_poolId_idx" ON "RideStatusHistory"("poolId");

-- CreateIndex
CREATE INDEX "RideStatusHistory_rideRequestId_idx" ON "RideStatusHistory"("rideRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_poolMembershipId_key" ON "WalletTransaction"("poolMembershipId");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_createdAt_idx" ON "WalletTransaction"("walletId", "createdAt");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideRequest" ADD CONSTRAINT "RideRequest_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pool" ADD CONSTRAINT "Pool_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolMembership" ADD CONSTRAINT "PoolMembership_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolMembership" ADD CONSTRAINT "PoolMembership_rideRequestId_fkey" FOREIGN KEY ("rideRequestId") REFERENCES "RideRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolMembership" ADD CONSTRAINT "PoolMembership_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideStatusHistory" ADD CONSTRAINT "RideStatusHistory_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideStatusHistory" ADD CONSTRAINT "RideStatusHistory_rideRequestId_fkey" FOREIGN KEY ("rideRequestId") REFERENCES "RideRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RideStatusHistory" ADD CONSTRAINT "RideStatusHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_poolMembershipId_fkey" FOREIGN KEY ("poolMembershipId") REFERENCES "PoolMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Business-rule backstops (docs/DATABASE.md). Prisma's schema language can't express
-- CHECK constraints or partial indexes, so these are appended by hand. The application
-- (row locks, conditional updates) is the primary enforcement; these hold even if the
-- application code is ever wrong.
ALTER TABLE "Vehicle"        ADD CONSTRAINT vehicle_capacity_range        CHECK (capacity BETWEEN 1 AND 7);
ALTER TABLE "Pool"           ADD CONSTRAINT pool_seats_within_capacity    CHECK ("occupiedSeats" >= 0 AND "occupiedSeats" <= capacity);
ALTER TABLE "RideRequest"    ADD CONSTRAINT ride_request_seats_positive   CHECK (seats >= 1);
ALTER TABLE "RideRequest"    ADD CONSTRAINT ride_request_distinct_zones   CHECK ("pickupZone" <> "destinationZone");
ALTER TABLE "PoolMembership" ADD CONSTRAINT membership_seats_positive     CHECK (seats >= 1);
ALTER TABLE "PoolMembership" ADD CONSTRAINT membership_fare_non_negative  CHECK ("farePoysha" >= 0);
ALTER TABLE "Wallet"         ADD CONSTRAINT wallet_balance_non_negative   CHECK ("balancePoysha" >= 0);
ALTER TABLE "WalletTransaction" ADD CONSTRAINT wallet_tx_amount_positive  CHECK ("amountPoysha" > 0);
ALTER TABLE "RideStatusHistory" ADD CONSTRAINT history_has_subject
  CHECK ("poolId" IS NOT NULL OR "rideRequestId" IS NOT NULL);

CREATE UNIQUE INDEX pool_one_active_per_vehicle
  ON "Pool" ("vehicleId") WHERE status IN ('MATCHED', 'DRIVER_ARRIVED', 'STARTED');
CREATE UNIQUE INDEX ride_request_one_active_per_passenger
  ON "RideRequest" ("passengerId") WHERE status IN ('REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED');
