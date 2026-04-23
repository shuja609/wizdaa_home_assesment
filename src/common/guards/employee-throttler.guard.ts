import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class EmployeeThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    if (req.user && req.user.sub) {
      return req.user.sub;
    }
    return req.ips.length ? req.ips[0] : req.ip;
  }
}
