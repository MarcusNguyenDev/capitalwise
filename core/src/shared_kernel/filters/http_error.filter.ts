import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

import { ErrorResponse } from '../types/error_response.type';

const DEFAULT_ERROR_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      this.logger.error('Unhandled non-HTTP exception', exception as Error);
      return;
    }
    const response = host.switchToHttp().getResponse<Response>();
    const error_response = this.buildErrorResponse(exception);
    response.status(error_response.status_code).json(error_response);
  }

  private buildErrorResponse(exception: unknown): ErrorResponse {
    if (exception instanceof HttpException) {
      const status_code = exception.getStatus();
      return {
        status_code,
        error_code: this.readErrorCode(exception, status_code),
        message: this.readMessage(exception),
      };
    }
    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : String(exception),
    );
    return {
      status_code: HttpStatus.INTERNAL_SERVER_ERROR,
      error_code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side.',
    };
  }

  private readErrorCode(exception: HttpException, status_code: number): string {
    const error_code = (exception as { error_code?: unknown }).error_code;
    if (typeof error_code === 'string') {
      return error_code;
    }
    return DEFAULT_ERROR_CODES[status_code] ?? 'HTTP_ERROR';
  }

  private readMessage(exception: HttpException): string {
    const response_body = exception.getResponse();
    if (typeof response_body === 'string') {
      return response_body;
    }
    const message = (response_body as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return message.join('; ');
    }
    return typeof message === 'string' ? message : exception.message;
  }
}
