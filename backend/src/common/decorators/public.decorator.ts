import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Every route needs a JWT unless marked @Public() (docs/API_SPEC.md).
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
