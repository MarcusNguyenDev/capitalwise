import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

interface ErrorResponseBody {
  status_code: number;
  error_code: string;
  message: string;
  // Extra machine-readable fields an error class declares in error_details,
  // for example { required_level, current_level }.
  [detail_key: string]: unknown;
}

const FALLBACK_ERROR_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
};

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const error_body =
      exception instanceof HttpException
        ? this.describeHttpException(exception)
        : this.describeUnexpectedError(exception);
    response.status(error_body.status_code).json(error_body);
  }

  private describeHttpException(exception: HttpException): ErrorResponseBody {
    const status_code = exception.getStatus();
    const declared_error_code = (exception as { error_code?: unknown })
      .error_code;
    const declared_details = (exception as { error_details?: unknown })
      .error_details;
    return {
      ...(typeof declared_details === 'object' && declared_details !== null
        ? declared_details
        : {}),
      status_code,
      error_code:
        typeof declared_error_code === 'string'
          ? declared_error_code
          : (FALLBACK_ERROR_CODES[status_code] ?? 'HTTP_ERROR'),
      message: exception.message,
    };
  }

  private describeUnexpectedError(exception: unknown): ErrorResponseBody {
    const error = exception instanceof Error ? exception : undefined;
    this.logger.error(
      { message: 'Unhandled error', error_message: error?.message },
      error?.stack,
    );
    return {
      status_code: HttpStatus.INTERNAL_SERVER_ERROR,
      error_code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side. Please try again.',
    };
  }
}
