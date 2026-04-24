import { SetMetadata } from '@nestjs/common';

/** Key used for storing role metadata in NestJS Reflector */
export const ROLES_KEY = 'roles';

/**
 * Decorator to restrict endpoint access to specific roles.
 * @param roles Array of roles (e.g., 'manager', 'employee') allowed to access the resource.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
