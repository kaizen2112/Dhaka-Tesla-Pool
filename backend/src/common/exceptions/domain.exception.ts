import { HttpException } from '@nestjs/common';

// A business-rule failure with a stable `code` the frontend switches on (docs/API_SPEC.md →
// Error shape). The response body is already that shape, so it's correct even before the
// global exception filter exists.
export class DomainException extends HttpException {
  constructor(
    readonly code: string,
    httpStatus: number,
    message: string,
  ) {
    super({ statusCode: httpStatus, error: code, message }, httpStatus);
  }
}
