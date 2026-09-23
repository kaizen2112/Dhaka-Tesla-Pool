import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainException } from '../exceptions/domain.exception';

const CODE_BY_STATUS: Record<number, string> = {
  400: 'VALIDATION_ERROR', // ValidationPipe, ParseUUIDPipe
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
};

// Every error leaves the API as { statusCode, error, message } (docs/API_SPEC.md → Error
// shape). The frontend switches on `error`, never on `message`.
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const body = this.toBody(exception);
    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body);
  }

  private toBody(exception: unknown) {
    if (exception instanceof DomainException) {
      return { statusCode: exception.getStatus(), error: exception.code, message: exception.message };
    }
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const error = CODE_BY_STATUS[statusCode] ?? HttpStatus[statusCode] ?? 'ERROR';
      return { statusCode, error, message: exception.message };
    }
    // A bug, not a business rule: log the details, don't leak them to the client.
    this.logger.error(exception);
    return { statusCode: 500, error: 'INTERNAL_ERROR', message: 'Something went wrong' };
  }
}
