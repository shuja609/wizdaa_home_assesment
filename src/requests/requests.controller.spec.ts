import { Test, TestingModule } from '@nestjs/testing';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { EmployeeThrottlerGuard } from '../common/guards/employee-throttler.guard';

describe('RequestsController', () => {
  let controller: RequestsController;
  let service: any;

  beforeEach(async () => {
    service = {
      createRequest: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      approveRequest: jest.fn(),
      rejectRequest: jest.fn(),
      cancelRequest: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RequestsController],
      providers: [{ provide: RequestsService, useValue: service }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(EmployeeThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RequestsController>(RequestsController);
  });

  // 1. Functional Test Cases
  describe('1. Functional Test Cases', () => {
    it('should map GET requests appropriately to employee filter', async () => {
      service.findAll.mockResolvedValue([{ id: '1' }]);
      const result = await controller.findAll('emp1', undefined, {
        user: { sub: 'emp1' },
      });
      expect(result).toEqual([{ id: '1' }]);
      expect(service.findAll).toHaveBeenCalledWith('emp1', undefined);
    });
  });

  // 5. Validation Test Cases
  describe('5. Validation Test Cases', () => {
    it('should explicitly forbid manager approvals parsing to domain layer with wrong mapping', async () => {
      service.approveRequest.mockResolvedValue({ id: '1', status: 'APPROVED' });
      await controller.approve('r1', 'm1');
      expect(service.approveRequest).toHaveBeenCalledWith('r1', 'm1');
    });
  });
});
