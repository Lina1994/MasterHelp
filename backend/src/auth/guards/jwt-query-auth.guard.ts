import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT Auth Guard that accepts token from query parameter 'token' as fallback.
 * Used for streaming endpoints where HTML media elements cannot set custom headers.
 * This guard REPLACES the class-level JwtAuthGuard for specific methods.
 */
@Injectable()
export class JwtQueryAuthGuard extends AuthGuard('jwt') {
  /**
   * Override canActivate to prevent class-level guards from interfering.
   */
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    
    // Accept token from query parameter OR Authorization header
    if (!request.headers.authorization && request.query.token) {
      request.headers.authorization = `Bearer ${request.query.token}`;
    }
    
    // Call parent canActivate which uses the JWT strategy
    return super.canActivate(context);
  }
}
