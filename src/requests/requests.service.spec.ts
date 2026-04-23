import { Test, TestingModule } from '@nestjs/testing';
import { RequestsService } from './requests.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  TimeOffRequest,
  RequestStatus,
} from '../database/entities/time-off-request.entity';
import { BalancesService } from '../balances/balances.service';
import { BadRequestException } from '@nestjs/common';

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
      ],
    }).compile();

    service = module.get<RequestsService>(RequestsService);
  });

  describe('createRequest', () => {
    const dto = {
      employeeId: 'e1',
      locationId: 'l1',
      leaveType: 'annual',
      startDate: '2026-04-20', // Monday
      endDate: '2026-04-21', // Tuesday
    };

    it('should create a PENDING request if balance is sufficient', async () => {
      balancesService.getBalances.mockResolvedValue([
        { leaveType: 'annual', balance: 10 },
      ]);

      const result = await service.createRequest(dto);

      expect(result.days).toBe(2);
      expect(result.status).toBe(RequestStatus.PENDING);
      expect(repo.save).toHaveBeenCalled();
    });

    it('should throw if balance is insufficient', async () => {
      balancesService.getBalances.mockResolvedValue([
        { leaveType: 'annual', balance: 1 },
      ]);

      await expect(service.createRequest(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if no business days in range', async () => {
      const weekendDto = {
        ...dto,
        startDate: '2026-04-25',
        endDate: '2026-04-26',
      };
      await expect(service.createRequest(weekendDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('approveRequest', () => {
    it('should approve a PENDING request and debit HCM', async () => {
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

    it('should throw if request is not PENDING', async () => {
      repo.findOne.mockResolvedValue({ status: RequestStatus.REJECTED });
      await expect(service.approveRequest('r1', 'm1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancelRequest', () => {
    it('should cancel an APPROVED request and credit HCM if within window', async () => {
      const request = {
        id: 'r1',
        status: RequestStatus.APPROVED,
        requestedAt: new Date(),
        employeeId: 'e1',
        leaveType: 'annual',
        days: 2,
      };
      repo.findOne.mockResolvedValue(request);
      balancesService.creditHcm.mockResolvedValue({ success: true });

      const result = await service.cancelRequest('r1');

      expect(result.status).toBe(RequestStatus.CANCELLED);
      expect(balancesService.creditHcm).toHaveBeenCalled();
    });
  });
});
