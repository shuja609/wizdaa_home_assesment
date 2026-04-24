import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Global Authentication and Authorization Guard.
 * 1. Validates the JWT Bearer token from the Authorization header.
 * 2. Enforces Role-Based Access Control (RBAC) via @Roles decorator.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    try {
      // Decode and verify the JWT payload.
      const payload = await this.jwtService.verifyAsync(token);
      request['user'] = payload;
    } catch {
      throw new UnauthorizedException('Invalid authentication token');
    }

    // Handle RBAC Check.
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true; // No roles defined, allows access to authenticated users.
    }

    const { user } = request;
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Required role [${requiredRoles.join(', ')}] not found for user type [${user.role}]`,
      );
    }

    return true;
  }

  /**
   * Helper to parse the Bearer token from the standard Authorization header.
   */
  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
