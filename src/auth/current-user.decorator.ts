import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

/** Pulls the authenticated user off the request — populated by JwtStrategy
 * after JwtAuthGuard verifies the token. Every group lookup goes through
 * userId sourced from here, never from client-supplied input. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
