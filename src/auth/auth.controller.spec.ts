import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            generateToken: jest.fn().mockResolvedValue('mock-jwt-token'),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should return an access token for the given payload', async () => {
      const payload = { sub: 'manager-123', role: 'manager' };
      const result = await controller.login(payload);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(authService.generateToken).toHaveBeenCalledWith(payload);
      expect(result).toEqual({ access_token: 'mock-jwt-token' });
    });
  });
});
