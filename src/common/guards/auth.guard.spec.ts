import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from './auth.guard';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: any;
  let reflector: any;

  beforeEach(async () => {
    jwtService = {
      verifyAsync: jest.fn(),
    };
    reflector = {
      getAllAndOverride: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: JwtService, useValue: jwtService },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();

    guard = module.get<AuthGuard>(AuthGuard);
  });

  const mockContext = (authHeader?: string, roles?: string[]) => {
    const request = {
      headers: {
        authorization: authHeader,
      },
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    reflector.getAllAndOverride.mockReturnValue(roles);
    return { context, request };
  };

  it('should throw UnauthorizedException if no token is provided', async () => {
    const { context } = mockContext();
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if token is invalid', async () => {
    const { context } = mockContext('Bearer invalid');
    jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should allow access if no roles are required', async () => {
    const { context } = mockContext('Bearer valid', undefined);
    jwtService.verifyAsync.mockResolvedValue({ role: 'employee' });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should allow access if user has required role', async () => {
    const { context } = mockContext('Bearer valid', ['employee']);
    jwtService.verifyAsync.mockResolvedValue({ role: 'employee' });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException if user lacks required role', async () => {
    const { context } = mockContext('Bearer valid', ['manager']);
    jwtService.verifyAsync.mockResolvedValue({ role: 'employee' });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
