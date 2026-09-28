-- CreateEnum
CREATE TYPE "ComplaintCategory" AS ENUM ('DANGEROUS_DRIVING', 'RUDE_BEHAVIOUR', 'VEHICLE_CONDITION', 'ROUTE_OR_FARE', 'SAFETY', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'ADMIN';

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "poolMembershipId" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "poolMembershipId" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "category" "ComplaintCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rating_poolMembershipId_key" ON "Rating"("poolMembershipId");

-- CreateIndex
CREATE INDEX "Rating_driverId_createdAt_idx" ON "Rating"("driverId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_poolMembershipId_key" ON "Complaint"("poolMembershipId");

-- CreateIndex
CREATE INDEX "Complaint_driverId_createdAt_idx" ON "Complaint"("driverId", "createdAt");

-- CreateIndex
CREATE INDEX "Complaint_status_createdAt_idx" ON "Complaint"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_poolMembershipId_fkey" FOREIGN KEY ("poolMembershipId") REFERENCES "PoolMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_poolMembershipId_fkey" FOREIGN KEY ("poolMembershipId") REFERENCES "PoolMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;




ALTER TABLE "Rating"    ADD CONSTRAINT rating_stars_range     CHECK (stars BETWEEN 1 AND 5);
ALTER TABLE "Rating"    ADD CONSTRAINT rating_comment_length  CHECK (comment IS NULL OR char_length(comment) <= 500);
ALTER TABLE "Complaint" ADD CONSTRAINT complaint_resolution_consistent
  CHECK ((status = 'OPEN') = ("resolvedAt" IS NULL AND "resolvedById" IS NULL AND "resolutionNote" IS NULL));
