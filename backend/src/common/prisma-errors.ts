import { Prisma } from '@prisma/client';

// P2002 = a unique constraint refused the write. Callers turn it into their own domain error
// (a double click racing to create the same row).
export function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
