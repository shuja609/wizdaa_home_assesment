import { Test, TestingModule } from '@nestjs/testing';
import { BalancesService } from './balances.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Balance } from '../database/entities/balance.entity';
import { HcmAdapter } from '../hcm/hcm.adapter';
import { ConfigService } from '@nestjs/config';

import {
  TimeOffRequest,
  RequestStatus,
} from '../database/entities/time-off-request.entity';
import { SyncLog } from '../database/entities/sync-log.entity';

describe('BalancesService', () => {
  let service: BalancesService;
  let repo: any;
  let requestRepo: any;
  let syncLogRepo: any;
  let adapter: any;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn().mockImplementation((d) => d),
      update: jest.fn(),
    };
    requestRepo = {
      find: jest.fn(),
      save: jest.fn(),
    };
    syncLogRepo = {
      save: jest.fn(),
      create: jest.fn().mockImplementation((d) => d),
    };
    adapter = {
      getBalance: jest.fn(),
      debitBalance: jest.fn(),
      creditBalance: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalancesService,
        {
          provide: getRepositoryToken(Balance),
          useValue: repo,
        },
        {
          provide: getRepositoryToken(TimeOffRequest),
          useValue: requestRepo,
        },
        {
          provide: getRepositoryToken(SyncLog),
          useValue: syncLogRepo,
        },
        {
          provide: HcmAdapter,
          useValue: adapter,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(5) },
        },
      ],
    }).compile();

    service = module.get<BalancesService>(BalancesService);
  });

  it('should fetch from HCM on cache miss', async () => {
    repo.find.mockResolvedValue([]);
    adapter.getBalance.mockResolvedValue([
      { leaveType: 'annual', balance: 10, hcmVersion: 'v1' },
    ]);
    repo.save.mockResolvedValue({ id: 1 });

    const result = await service.getBalances('e1', 'l1');

    expect(adapter.getBalance).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('should serve from cache if not stale', async () => {
    const cachedBalance = {
      employeeId: 'e1',
      lastSyncedAt: new Date(),
    };
    repo.find.mockResolvedValue([cachedBalance]);

    const result = await service.getBalances('e1', 'l1');

    expect(adapter.getBalance).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(cachedBalance);
  });
  describe('processBatchUpdate', () => {
    it('should flag pending requests rather than overwriting balance', async () => {
      const batchDto = {
        updates: [
          {
            employeeId: 'e1',
            locationId: 'l1',
            leaveType: 'annual',
            balance: 5,
            hcmVersion: 'v2',
          },
        ],
      };
      // Local diff exists
      repo.findOne.mockResolvedValue({
        employeeId: 'e1',
        locationId: 'l1',
        leaveType: 'annual',
        balance: 10,
      });
      // Conflict! PENDING request exists
      requestRepo.find.mockResolvedValue([
        { id: 'req1', status: RequestStatus.PENDING },
      ]);

      const result = await service.processBatchUpdate(batchDto);

      expect(result.conflicts).toBe(1);
      expect(result.updated).toBe(0);
      expect(requestRepo.save).toHaveBeenCalled(); // Should flag request
      expect(repo.update).not.toHaveBeenCalled(); // Should NOT update balance
    });

    it('should update balance if no pending conflicts', async () => {
      const batchDto = {
        updates: [
          {
            employeeId: 'e1',
            locationId: 'l1',
            leaveType: 'annual',
            balance: 5,
            hcmVersion: 'v2',
          },
        ],
      };
      // Local diff exists
      repo.findOne.mockResolvedValue({
        employeeId: 'e1',
        locationId: 'l1',
        leaveType: 'annual',
        balance: 10,
      });
      // No Conflict
      requestRepo.find.mockResolvedValue([]);

      const result = await service.processBatchUpdate(batchDto);

      expect(result.conflicts).toBe(0);
      expect(result.updated).toBe(1);
      expect(repo.update).toHaveBeenCalled(); // Should update balance
    });
  });
});
