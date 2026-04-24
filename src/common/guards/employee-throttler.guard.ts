import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Specialized Throttler Guard that tracks rate limits by Employee ID (sub).
 * Used to enforce the "10 requests per minute per employee" requirement for submissions.
 */
@Injectable()
export class EmployeeThrottlerGuard extends ThrottlerGuard {
  /**
   * Overrides the tracking key to use the specific employee ID from the JWT payload.
   * Falls back to IP address if the request is unauthenticated (though typically used behind AuthGuard).
   */
  protected getTracker(req: Record<string, any>): Promise<string> {
    if (req.user && req.user.sub) {
      return req.user.sub;
    }
    return req.ips.length ? req.ips[0] : req.ip;
  }
}
