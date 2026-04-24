import { Test, TestingModule } from '@nestjs/testing';
import { RequestsService } from './requests.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  TimeOffRequest,
  RequestStatus,
} from '../database/entities/time-off-request.entity';
import { BalancesService } from '../balances/balances.service';
import { BadRequestException } from '@nestjs/common';
import { MutexService } from '../common/utils/mutex.service';

describe('RequestsService', () => {
  let service: RequestsService;
  let repo: any;
  let balancesService: any;

  beforeEach(async () => {
    repo = {
      create: jest.fn().mockImplementation((d) => d),
      save: jest
        .fn()
        .mockImplementation((d) => Promise.resolve({ id: 'uuid', ...d })),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    balancesService = {
      getBalances: jest.fn(),
      syncBalances: jest.fn(),
      debitHcm: jest.fn(),
      creditHcm: jest.fn(),
    };
    const mutexService = {
      acquire: jest.fn().mockResolvedValue(jest.fn()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestsService,
        {
          provide: getRepositoryToken(TimeOffRequest),
          useValue: repo,
        },
        {
          provide: BalancesService,
          useValue: balancesService,
        },
        {
          provide: MutexService,
          useValue: mutexService,
        },
      ],
    }).compile();

    service = module.get<RequestsService>(RequestsService);
  });

  const dto = {
    employeeId: 'e1',
    locationId: 'l1',
    leaveType: 'annual',
    startDate: '2026-04-20', // Monday
    endDate: '2026-04-21', // Tuesday
  };

  // 1. Functional Test Cases
  describe('1. Functional Test Cases', () => {
    it('should create a PENDING request if balance is sufficient functionally', async () => {
      balancesService.getBalances.mockResolvedValue([
        { leaveType: 'annual', balance: 10 },
      ]);
      const result = await service.createRequest(dto);
      expect(result.days).toBe(2);
      expect(result.status).toBe(RequestStatus.PENDING);
      expect(repo.save).toHaveBeenCalled();
    });

    it('should successfully fully approve a PENDING request and trigger debit HCM sync', async () => {
      const request = {
        id: 'r1',
        employeeId: 'e1',
        leaveType: 'annual',
        days: 2,
        status: RequestStatus.PENDING,
      };
      repo.findOne.mockResolvedValue(request);
      balancesService.syncBalances.mockResolvedValue([
        { leaveType: 'annual', balance: 10 },
      ]);
      balancesService.debitHcm.mockResolvedValue({
        success: true,
        newBalance: 8,
      });

      const result = await service.approveRequest('r1', 'm1');
      expect(result.status).toBe(RequestStatus.APPROVED);
      expect(balancesService.debitHcm).toHaveBeenCalledWith(
        'e1',
        undefined,
        'annual',
        2,
      );
    });
  });

  // 2. Negative Test Cases
  describe('2. Negative Test Cases', () => {
    it('should hard reject creating a request if balance drops below threshold natively', async () => {
      balancesService.getBalances.mockResolvedValue([
        { leaveType: 'annual', balance: 1 },
      ]);
      await expect(service.createRequest(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should block approval if the request is NOT in PENDING status currently', async () => {
      repo.findOne.mockResolvedValue({ status: RequestStatus.REJECTED });
      await expect(service.approveRequest('r1', 'm1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should fail cancelation if the cancel window has passed locally', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);
      const request = {
        id: 'r1',
        status: RequestStatus.APPROVED,
        requestedAt: pastDate,
      };
      repo.findOne.mockResolvedValue(request);
      await expect(service.cancelRequest('r1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // 3. Edge Test Cases
  describe('3. Edge Test Cases', () => {
    it('should gracefully handle 0 business days spanned (e.g. only weekend days)', async () => {
      const weekendDto = {
        ...dto,
        startDate: '2026-04-25', // Saturday
        endDate: '2026-04-26', // Sunday
      };
      await expect(service.createRequest(weekendDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should safely reject approval if HCM external bridge immediately fails post-approval attempts', async () => {
      const request = {
        id: 'r1',
        status: RequestStatus.PENDING,
        days: 2,
      };
      repo.findOne.mockResolvedValue(request);
      balancesService.syncBalances.mockResolvedValue([
        { leaveType: 'annual', balance: 10 },
      ]);
      balancesService.debitHcm.mockResolvedValue({
        success: false,
        message: 'HCM Error',
      });

      await expect(service.approveRequest('r1', 'm1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // 4. Boundary Value Test Cases
  describe('4. Boundary Value Test Cases', () => {
    it('should perfectly ingest exactly matching balance bounds constraint (N request out of N balance)', async () => {
      balancesService.getBalances.mockResolvedValue([
        { leaveType: 'annual', balance: 2 },
      ]);
      const result = await service.createRequest(dto);
      expect(result.days).toBe(2);
      expect(result.status).toBe(RequestStatus.PENDING);
    });
  });

  // 5. Validation Test Cases
  describe('5. Validation Test Cases', () => {
    it('should enforce proper data retrieval tracking during employee payload fetches natively', async () => {
      repo.find.mockResolvedValue([]);
      const query = await service.findAll('emp-404');
      expect(query).toEqual([]);
      expect(repo.find).toHaveBeenCalledWith({
        where: { employeeId: 'emp-404' },
        order: { requestedAt: 'DESC' },
      });
    });

    it('should enforce rejection sequence parsing correctly updating fields', async () => {
      const request = {
        id: 'r1',
        status: RequestStatus.PENDING,
      };
      repo.findOne.mockResolvedValue(request);
      const result = await service.rejectRequest('r1', 'mgr-1');
      expect(result.status).toBe(RequestStatus.REJECTED);
      expect(result.managerId).toBe('mgr-1');
    });
  });
});
