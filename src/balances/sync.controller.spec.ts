import { Test, TestingModule } from '@nestjs/testing';
import { SyncController } from './sync.controller';
import { BalancesService } from './balances.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SyncLog } from '../database/entities/sync-log.entity';

describe('SyncController', () => {
  let controller: SyncController;
  let balancesService: any;
  let syncLogRepo: any;

  beforeEach(async () => {
    balancesService = {
      processBatchUpdate: jest.fn(),
    };
    syncLogRepo = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SyncController],
      providers: [
        { provide: BalancesService, useValue: balancesService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
        {
          provide: getRepositoryToken(SyncLog),
          useValue: syncLogRepo,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SyncController>(SyncController);
  });

  // 1. Functional Test Cases
  describe('1. Functional Test Cases', () => {
    it('should execute processBatch correctly', async () => {
      balancesService.processBatchUpdate.mockResolvedValue({ processed: 1 });
      const payload = {
        hcmVersion: 2,
        updates: [{ employeeId: 'e', locationId: 'l', balances: [] }],
      };

      const res = await controller.processBatch(payload as any, 'test-secret');
      expect(res).toEqual({ processed: 1 });
    });

    it('should fetch recent logs safely', async () => {
      syncLogRepo.find.mockResolvedValue([{ id: 1 }]);
      const res = await controller.getSyncStatus();
      expect(res).toEqual({ recentLogs: [{ id: 1 }] });
    });
  });

  // 5. Validation Test Cases
  describe('5. Validation Test Cases', () => {
    it('should block bad local syncs without secrets', async () => {
      await expect(
        controller.processBatch({} as any, 'wrong-secret'),
      ).rejects.toThrow();
    });
  });
});
