import { Test, TestingModule } from '@nestjs/testing';
import { SyncService } from './sync.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Balance } from '../database/entities/balance.entity';
import { TimeOffRequest, RequestStatus } from '../database/entities/time-off-request.entity';
import { SyncLog } from '../database/entities/sync-log.entity';
import { BalancesService } from './balances.service';
import { HcmAdapter } from '../hcm/hcm.adapter';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('SyncService', () => {
  let service: SyncService;
  let balanceRepo: any;
  let requestRepo: any;
  let syncLogRepo: any;
  let adapter: any;
  let eventEmitter: any;

  beforeEach(async () => {
    balanceRepo = {
      find: jest.fn(),
      save: jest.fn(),
    };
    requestRepo = {
      count: jest.fn(),
    };
    syncLogRepo = {
      save: jest.fn(),
      create: jest.fn().mockImplementation(d => d),
    };
    adapter = {
      getBalance: jest.fn(),
    };
    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: getRepositoryToken(Balance), useValue: balanceRepo },
        { provide: getRepositoryToken(TimeOffRequest), useValue: requestRepo },
        { provide: getRepositoryToken(SyncLog), useValue: syncLogRepo },
        { provide: BalancesService, useValue: {} },
        { provide: HcmAdapter, useValue: adapter },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
  });

  it('should detect and correct drift', async () => {
    const localBalance = { employeeId: 'e1', locationId: 'l1', leaveType: 'annual', balance: 10 };
    balanceRepo.find.mockResolvedValue([localBalance]);
    adapter.getBalance.mockResolvedValue([{ leaveType: 'annual', balance: 8, hcmVersion: 2 }]);
    requestRepo.count.mockResolvedValue(1); // Pending request exists

    await service.handleDriftDetection();

    expect(balanceRepo.save).toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith('balance.drift', expect.any(Object));
    expect(syncLogRepo.save).toHaveBeenCalled();
  });

  it('should skip correction if no drift detected', async () => {
    const localBalance = { employeeId: 'e1', locationId: 'l1', leaveType: 'annual', balance: 10 };
    balanceRepo.find.mockResolvedValue([localBalance]);
    adapter.getBalance.mockResolvedValue([{ leaveType: 'annual', balance: 10, hcmVersion: 1 }]);

    await service.handleDriftDetection();

    expect(balanceRepo.save).not.toHaveBeenCalled();
  });

  it('should handle errors during drift analysis of individual employees', async () => {
    balanceRepo.find.mockResolvedValue([{ employeeId: 'e1' }]);
    adapter.getBalance.mockRejectedValue(new Error('Fetch Error'));

    await expect(service.handleDriftDetection()).resolves.not.toThrow();
  });
});
