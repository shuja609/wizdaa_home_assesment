import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TimeOffRequest,
  RequestStatus,
} from '../database/entities/time-off-request.entity';
import { CreateRequestDto } from './dto/create-request.dto';
import { calculateBusinessDays } from '../common/utils/date.utils';
import { BalancesService } from '../balances/balances.service';

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    @InjectRepository(TimeOffRequest)
    private readonly requestRepository: Repository<TimeOffRequest>,
    private readonly balancesService: BalancesService,
  ) {}

  async createRequest(dto: CreateRequestDto): Promise<TimeOffRequest> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate > endDate) {
      throw new BadRequestException('Start date cannot be after end date');
    }

    const days = calculateBusinessDays(startDate, endDate);
    if (days === 0) {
      throw new BadRequestException(
        'Request does not include any business days',
      );
    }

    // Local balance pre-check
    const balances = await this.balancesService.getBalances(
      dto.employeeId,
      dto.locationId,
    );
    const balance = balances.find((b) => b.leaveType === dto.leaveType);

    if (!balance || balance.balance < days) {
      throw new BadRequestException(
        `Insufficient ${dto.leaveType} balance. Required: ${days}, Available: ${balance?.balance ?? 0}`,
      );
    }

    const request = this.requestRepository.create({
      ...dto,
      days,
      status: RequestStatus.PENDING,
    });

    return this.requestRepository.save(request);
  }

  async findAll(
    employeeId?: string,
    status?: RequestStatus,
  ): Promise<TimeOffRequest[]> {
    const where: any = {};
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;

    return this.requestRepository.find({
      where,
      order: { requestedAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<TimeOffRequest> {
    const request = await this.requestRepository.findOne({ where: { id } });
    if (!request) {
      throw new BadRequestException('Request not found');
    }
    return request;
  }

  async approveRequest(id: string, managerId: string): Promise<TimeOffRequest> {
    const request = await this.findOne(id);
    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException(
        `Cannot approve request in ${request.status} status`,
      );
    }

    // 1. Force-sync balance from HCM (Mandatory per PRD)
    const balances = await this.balancesService.syncBalances(
      request.employeeId,
      request.locationId,
    );
    const balance = balances.find((b) => b.leaveType === request.leaveType);

    // 2. Re-validate balance
    if (!balance || balance.balance < request.days) {
      throw new BadRequestException(
        `Insufficient ${request.leaveType} balance at HCM. Available: ${balance?.balance ?? 0}, Required: ${request.days}`,
      );
    }

    // 3. Call HCM Debit
    try {
      const hcmResult = await this.balancesService.debitHcm(
        request.employeeId,
        request.locationId,
        request.leaveType,
        request.days,
      );

      if (hcmResult.success) {
        request.status = RequestStatus.APPROVED;
        request.managerId = managerId;
        request.resolvedAt = new Date();
        request.hcmSubmitted = true;
      } else {
        request.hcmError = 'HCM debit failed at external system';
        throw new BadRequestException(request.hcmError);
      }
    } catch (error) {
      request.hcmError = error.message;
      await this.requestRepository.save(request);
      throw error;
    }

    return this.requestRepository.save(request);
  }

  async rejectRequest(id: string, managerId: string): Promise<TimeOffRequest> {
    const request = await this.findOne(id);
    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException(
        `Cannot reject request in ${request.status} status`,
      );
    }

    request.status = RequestStatus.REJECTED;
    request.managerId = managerId;
    request.resolvedAt = new Date();

    return this.requestRepository.save(request);
  }

  async cancelRequest(id: string): Promise<TimeOffRequest> {
    const request = await this.findOne(id);

    if (request.status === RequestStatus.CANCELLED) {
      return request;
    }

    if (request.status === RequestStatus.REJECTED) {
      throw new BadRequestException('Cannot cancel a rejected request');
    }

    if (request.status === RequestStatus.APPROVED) {
      // Check grace window
      const graceHours = 24; // Default as per PRD; could be from config
      const hoursSinceRequest =
        (Date.now() - new Date(request.requestedAt).getTime()) /
        (1000 * 60 * 60);

      if (hoursSinceRequest > graceHours) {
        throw new BadRequestException(
          `Cancellation window (${graceHours}h) has expired for this approved request`,
        );
      }

      // Rollback HCM debit
      try {
        const hcmResult = await this.balancesService.creditHcm(
          request.employeeId,
          request.locationId,
          request.leaveType,
          request.days,
        );

        if (!hcmResult.success) {
          this.logger.error(
            `Failed to credit HCM on cancellation for request ${id}`,
          );
          // Still cancel locally but log the failure
        }
      } catch (error) {
        this.logger.error(
          `HCM communication error during cancellation: ${error.message}`,
        );
      }
    }

    request.status = RequestStatus.CANCELLED;
    return this.requestRepository.save(request);
  }
}
