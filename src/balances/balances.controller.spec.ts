import { Test, TestingModule } from '@nestjs/testing';
import { BalancesController } from './balances.controller';
import { BalancesService } from './balances.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { EmployeeThrottlerGuard } from '../common/guards/employee-throttler.guard';

describe('BalancesController', () => {
  let controller: BalancesController;
  let service: any;

  beforeEach(async () => {
    service = {
      getBalances: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BalancesController],
      providers: [{ provide: BalancesService, useValue: service }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(EmployeeThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BalancesController>(BalancesController);
  });

  // 1. Functional Test Cases
  describe('1. Functional Test Cases', () => {
    it('should map balance fetch parameters directly safely', async () => {
      service.getBalances.mockResolvedValue([{ balance: 10 }]);
      const result = await controller.getBalances('e1', 'l1', {
        user: { sub: 'e1', role: 'employee' },
      });
      expect(result).toEqual([{ balance: 10 }]);
      expect(service.getBalances).toHaveBeenCalledWith('e1', 'l1');
    });
  });

  // 5. Validation Test Cases
  describe('5. Validation Test Cases', () => {
    it('should reject employee requests matching mismatched identities locally internally', async () => {
      await expect(
        controller.getBalances('e2', 'l1', {
          user: { sub: 'e1', role: 'employee' },
        }),
      ).rejects.toThrow();
    });
  });
});
