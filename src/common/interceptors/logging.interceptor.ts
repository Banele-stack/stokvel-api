import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/** Registered globally (see main.ts). One log line per request — never
 * logs bodies, since a login/register body has a password in it. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: { userId?: string } }>();
    const res = context.switchToHttp().getResponse<Response>();
    const { method, originalUrl } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.log(method, originalUrl, res.statusCode, start, req.user?.userId),
        error: (err: { status?: number }) =>
          this.log(method, originalUrl, err?.status ?? 500, start, req.user?.userId),
      }),
    );
  }

  private log(method: string, url: string, status: number, start: number, userId?: string) {
    const ms = Date.now() - start;
    this.logger.log(`${method} ${url} ${status} ${ms}ms${userId ? ` user=${userId}` : ''}`);
  }
}
