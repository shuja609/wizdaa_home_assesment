import { Test, TestingModule } from '@nestjs/testing';
import { BalancesService } from './balances.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Balance } from '../database/entities/balance.entity';
import { HcmAdapter } from '../hcm/hcm.adapter';
import { ConfigService } from '@nestjs/config';

describe('BalancesService', () => {
  let service: BalancesService;
  let repo: any;
  let adapter: any;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn().mockImplementation((d) => d),
    };
    adapter = {
      getBalance: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalancesService,
        {
          provide: getRepositoryToken(Balance),
          useValue: repo,
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
    adapter.getBalance.mockResolvedValue([{ leaveType: 'annual', balance: 10, hcmVersion: 'v1' }]);
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
});
