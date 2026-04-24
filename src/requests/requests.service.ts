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
import { MutexService } from '../common/utils/mutex.service';

/**
 * Service responsible for the Time-Off Request lifecycle.
 * Manages submission, validation, manager approval/rejection, and employee cancellation.
 */
@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    @InjectRepository(TimeOffRequest)
    private readonly requestRepository: Repository<TimeOffRequest>,
    private readonly balancesService: BalancesService,
    private readonly mutexService: MutexService,
  ) {}

  /**
   * Submits a new time-off request.
   * Performs an initial local balance check to avoid unnecessary PENDING clutter.
   */
  async createRequest(dto: CreateRequestDto): Promise<TimeOffRequest> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    // Basic date range validation.
    if (startDate > endDate) {
      throw new BadRequestException('Start date cannot be after end date');
    }

    // Calculate duration excluding weekends.
    const days = calculateBusinessDays(startDate, endDate);
    if (days === 0) {
      throw new BadRequestException(
        'Request does not include any business days',
      );
    }

    // Defensive local balance pre-check using cached version (forced sync happen on approval).
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

  /**
   * Fetches requests based on optional filters for employee and status.
   */
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

  /**
   * Retrieves a single request by ID or throws if not found.
   */
  async findOne(id: string): Promise<TimeOffRequest> {
    const request = await this.requestRepository.findOne({ where: { id } });
    if (!request) {
      throw new BadRequestException('Request not found');
    }
    return request;
  }

  /**
   * Approves a PENDING request.
   * Forces a real-time HCM balance validation and performs the debit operation.
   *
   * @param id Request UUID.
   * @param managerId ID of the approving manager.
   */
  async approveRequest(id: string, managerId: string): Promise<TimeOffRequest> {
    const request = await this.findOne(id);
    
    // Serialize per employee to prevent race conditions during balance check + debit
    const release = await this.mutexService.acquire(request.employeeId);
    try {
      if (request.status !== RequestStatus.PENDING) {
        throw new BadRequestException(
          `Cannot approve request in ${request.status} status`,
        );
      }

      // 1. Mandatory real-time balance sync from HCM authoritative source.
      const balances = await this.balancesService.syncBalances(
        request.employeeId,
        request.locationId,
      );
      const balance = balances.find((b) => b.leaveType === request.leaveType);

      // 2. Final re-validation before commit.
      if (!balance || balance.balance < request.days) {
        throw new BadRequestException(
          `Insufficient ${request.leaveType} balance at HCM. Available: ${balance?.balance ?? 0}, Required: ${request.days}`,
        );
      }

      // 3. Atomic attempt to debit HCM.
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
      } catch (error: any) {
        // Log the error and preserve it in the request audit trail.
        request.hcmError = error.message;
        await this.requestRepository.save(request);
        throw error;
      }

      return await this.requestRepository.save(request);
    } finally {
      release();
    }
  }

  /**
   * Rejects a PENDING request.
   */
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

  /**
   * Employee-led request cancellation.
   * Handles rollback of HCM credits if the request is already approved but within the grace window.
   */
  async cancelRequest(id: string): Promise<TimeOffRequest> {
    const request = await this.findOne(id);

    if (request.status === RequestStatus.CANCELLED) {
      return request;
    }

    if (request.status === RequestStatus.REJECTED) {
      throw new BadRequestException('Cannot cancel a rejected request');
    }

    const release = await this.mutexService.acquire(request.employeeId);
    try {
      if (request.status === RequestStatus.APPROVED) {
        // Enforce the 24h grace window for approved request rollbacks.
        const graceHours = 24;
        const hoursSinceRequest =
          (Date.now() - new Date(request.requestedAt).getTime()) /
          (1000 * 60 * 60);

        if (hoursSinceRequest > graceHours) {
          throw new BadRequestException(
            `Cancellation window (${graceHours}h) has expired for this approved request`,
          );
        }

        // Rollback HCM debit to maintain synchronization.
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
          }
        } catch (error: any) {
          this.logger.error(
            `HCM communication error during cancellation: ${error.message}`,
          );
        }
      }

      request.status = RequestStatus.CANCELLED;
      return await this.requestRepository.save(request);
    } finally {
      release();
    }
  }
}
