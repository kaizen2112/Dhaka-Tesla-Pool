import { ForbiddenException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { DomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';

// Writes only PoolMembership.paymentMethod/paidAt, Wallet and WalletTransaction
// (docs/ARCHITECTURE.md §2). No real gateway: CASH is recorded, WALLET is simulated TeslaPay.
@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  // docs/ARCHITECTURE.md §4.5 / §8 Payment — one transaction.
  pay(passengerId: string, membershipId: string, method: PaymentMethod) {
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.poolMembership.findUnique({
        where: { id: membershipId },
        include: { pool: true },
      });
      if (!membership) throw new NotFoundException('Booking not found');
      if (membership.passengerId !== passengerId) {
        throw new ForbiddenException('This booking is not yours');
      }
      // COMPLETED is terminal and the final fare never changes after it, so no pool lock needed.
      if (membership.pool.status !== 'COMPLETED' || membership.cancelledAt) {
        throw new DomainException(
          'PAYMENT_NOT_ALLOWED',
          HttpStatus.CONFLICT,
          'You can only pay for a completed ride you were on',
        );
      }

      // Conditional update: two simultaneous payments both try this; the second waits on the
      // row lock, re-checks `paidAt IS NULL`, and matches 0 rows.
      const paidAt = new Date();
      const { count } = await tx.poolMembership.updateMany({
        where: { id: membershipId, paidAt: null, cancelledAt: null },
        data: { paymentMethod: method, paidAt },
      });
      if (count !== 1) {
        throw new DomainException('ALREADY_PAID', HttpStatus.CONFLICT, 'This ride is already paid');
      }

      let walletBalancePoysha: number | null = null;
      if (method === 'WALLET') {
        const fare = membership.farePoysha;
        // Decrement only if the balance covers it — the check and the write are one statement,
        // so the balance can't go negative (the DB CHECK is the backstop).
        const { count: debited } = await tx.wallet.updateMany({
          where: { userId: passengerId, balancePoysha: { gte: fare } },
          data: { balancePoysha: { decrement: fare } },
        });
        if (debited !== 1) {
          // Throwing rolls back the paidAt update above too.
          throw new DomainException(
            'INSUFFICIENT_FUNDS',
            HttpStatus.UNPROCESSABLE_ENTITY,
            'Not enough TeslaPay balance for this fare',
          );
        }
        const wallet = await tx.wallet.update({
          where: { userId: passengerId },
          data: {
            transactions: {
              create: { type: 'DEBIT', amountPoysha: fare, poolMembershipId: membershipId },
            },
          },
        });
        walletBalancePoysha = wallet.balancePoysha;
      }

      return {
        membershipId,
        farePoysha: membership.farePoysha,
        paymentMethod: method,
        paidAt,
        walletBalancePoysha,
      };
    });
  }

  async getMyWallet(passengerId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: passengerId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { id: true, type: true, amountPoysha: true, poolMembershipId: true, createdAt: true },
        },
      },
    });
    if (!wallet) throw new NotFoundException('You have no wallet');
    return { balancePoysha: wallet.balancePoysha, transactions: wallet.transactions };
  }
}
