import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Balance } from '../database/entities/balance.entity';
import {
  TimeOffRequest,
  RequestStatus,
} from '../database/entities/time-off-request.entity';
import { SyncLog, SyncLogType } from '../database/entities/sync-log.entity';
import { HcmAdapter } from '../hcm/hcm.adapter';
import { ConfigService } from '@nestjs/config';
import { HcmBatchDto } from '../hcm/dto/hcm-batch.dto';

@Injectable()
export class BalancesService {
  private readonly logger = new Logger(BalancesService.name);
  private readonly syncThresholdMin: number;

  constructor(
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
    @InjectRepository(TimeOffRequest)
    private readonly requestRepository: Repository<TimeOffRequest>,
    @InjectRepository(SyncLog)
    private readonly syncLogRepository: Repository<SyncLog>,
    private readonly hcmAdapter: HcmAdapter,
    private readonly configService: ConfigService,
  ) {
    this.syncThresholdMin = this.configService.get<number>(
      'HCM_SYNC_THRESHOLD_MIN',
      5,
    );
  }

  /**
   * Gets all balances for an employee at a location.
   * Checks local cache first; syncs from HCM if stale or missing.
   */
  async getBalances(
    employeeId: string,
    locationId: string,
  ): Promise<Balance[]> {
    const localBalances = await this.balanceRepository.find({
      where: { employeeId, locationId },
    });

    const isStale =
      localBalances.length === 0 || this.isStale(localBalances[0]);

    if (isStale) {
      this.logger.log(
        `Cache miss or stale for ${employeeId}. Syncing from HCM...`,
      );
      return this.syncBalances(employeeId, locationId);
    }

    this.logger.log(`Serving cached balances for ${employeeId}`);
    return localBalances;
  }

  /**
   * Forces a synchronization with the HCM system.
   */
  async syncBalances(
    employeeId: string,
    locationId: string,
  ): Promise<Balance[]> {
    const hcmBalances = await this.hcmAdapter.getBalance(
      employeeId,
      locationId,
    );

    const now = new Date();
    const updatedBalances: Balance[] = [];

    for (const hb of hcmBalances) {
      let balance = await this.balanceRepository.findOne({
        where: { employeeId, locationId, leaveType: hb.leaveType },
      });

      if (!balance) {
        balance = this.balanceRepository.create({
          employeeId,
          locationId,
          leaveType: hb.leaveType,
        });
      }

      balance.balance = hb.balance;
      balance.hcmVersion = hb.hcmVersion;
      balance.lastSyncedAt = now;

      updatedBalances.push(await this.balanceRepository.save(balance));
    }

    return updatedBalances;
  }

  private isStale(balance: Balance): boolean {
    const thresholdMs = this.syncThresholdMin * 60 * 1000;
    const timeSinceSync = Date.now() - new Date(balance.lastSyncedAt).getTime();
    return timeSinceSync > thresholdMs;
  }

  async debitHcm(
    employeeId: string,
    locationId: string,
    leaveType: string,
    days: number,
  ) {
    const result = await this.hcmAdapter.debitBalance(
      employeeId,
      locationId,
      leaveType,
      days,
    );
    if (result.success) {
      let finalBalance = result.newBalance;

      // F2.2: Defensive behavior on HCM silence
      // If HCM returns 2xx but no confirmation of new balance, re-fetch after 2s
      if (finalBalance === undefined) {
        this.logger.warn(
          `HCM returned success but no balance confirmation for ${employeeId}. Re-fetching in 2s...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const refetchedTotal = await this.hcmAdapter.getBalance(
          employeeId,
          locationId,
        );
        const refetched = refetchedTotal.find((b) => b.leaveType === leaveType);
        finalBalance = refetched?.balance;
      }

      if (finalBalance !== undefined) {
        await this.balanceRepository.update(
          { employeeId, locationId, leaveType },
          {
            balance: finalBalance,
            lastSyncedAt: new Date(),
          },
        );
      }
    }
    return result;
  }

  async creditHcm(
    employeeId: string,
    locationId: string,
    leaveType: string,
    days: number,
  ) {
    const result = await this.hcmAdapter.creditBalance(
      employeeId,
      locationId,
      leaveType,
      days,
    );
    if (result.success) {
      let finalBalance = result.newBalance;

      // F2.2: Defensive behavior on HCM silence
      if (finalBalance === undefined) {
        this.logger.warn(
          `HCM returned success but no balance confirmation for ${employeeId} on credit. Re-fetching in 2s...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const refetchedTotal = await this.hcmAdapter.getBalance(
          employeeId,
          locationId,
        );
        const refetched = refetchedTotal.find((b) => b.leaveType === leaveType);
        finalBalance = refetched?.balance;
      }

      if (finalBalance !== undefined) {
        await this.balanceRepository.update(
          { employeeId, locationId, leaveType },
          {
            balance: finalBalance,
            lastSyncedAt: new Date(),
          },
        );
      }
    }
    return result;
  }

  async processBatchUpdate(batchDto: HcmBatchDto) {
    const now = new Date();
    let conflicts = 0;
    let updated = 0;

    for (const update of batchDto.updates) {
      // 1. Check if balance differs
      const localBalance = await this.balanceRepository.findOne({
        where: {
          employeeId: update.employeeId,
          locationId: update.locationId,
          leaveType: update.leaveType,
        },
      });

      // If missing locally, just insert it
      if (!localBalance) {
        await this.balanceRepository.save(
          this.balanceRepository.create({
            ...update,
            lastSyncedAt: now,
          }),
        );
        updated++;
        continue;
      }

      // If there's no drift, skip
      if (localBalance.balance === update.balance) {
        // Just update the version and timestamp
        await this.balanceRepository.update(
          {
            employeeId: update.employeeId,
            locationId: update.locationId,
            leaveType: update.leaveType,
          },
          { lastSyncedAt: now, hcmVersion: update.hcmVersion },
        );
        continue;
      }

      // 2. We have a difference. Check for PENDING requests.
      const pendingRequests = await this.requestRepository.find({
        where: {
          employeeId: update.employeeId,
          locationId: update.locationId,
          leaveType: update.leaveType,
          status: RequestStatus.PENDING,
        },
      });

      if (pendingRequests.length > 0) {
        // Conflict! Flag the requests, don't touch the balance.
        for (const req of pendingRequests) {
          req.pendingConflict = true;
          await this.requestRepository.save(req);
        }
        conflicts++;
      } else {
        // Safe to update
        await this.balanceRepository.update(
          {
            employeeId: update.employeeId,
            locationId: update.locationId,
            leaveType: update.leaveType,
          },
          {
            balance: update.balance,
            lastSyncedAt: now,
            hcmVersion: update.hcmVersion,
          },
        );
        updated++;
      }
    }

    // 3. Log the batch sync event
    await this.syncLogRepository.save(
      this.syncLogRepository.create({
        type: SyncLogType.BATCH,
        triggeredBy: 'webhook',
        status: 'SUCCESS',
        detail: JSON.stringify({
          processed: batchDto.updates.length,
          updated,
          conflicts,
        }),
      }),
    );

    return { processed: batchDto.updates.length, updated, conflicts };
  }
}
