import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Balance } from '../database/entities/balance.entity';
import { SyncLog, SyncLogType } from '../database/entities/sync-log.entity';
import { BalancesService } from './balances.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
    @InjectRepository(SyncLog)
    private readonly syncLogRepository: Repository<SyncLog>,
    private readonly balancesService: BalancesService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleDriftDetection() {
    this.logger.log('Starting scheduled drift detection...');

    // In a massive system, we'd chunk this. For this sample, we process all active locals.
    const allLocalBalances = await this.balanceRepository.find();
    let driftCount = 0;

    for (const local of allLocalBalances) {
      try {
        // Force sync from HCM to get current authoritative state
        // wait, syncBalances actually overwrites the local balance automatically inside BalancesService.
        // So calling syncBalances will implicitly correct the drift.
        // But we want to know IF there was a drift so we can log it.
        // Let's refactor slightly: we'll fetch from HCM adapter first.
        const hcmBalances = await this.balancesService['hcmAdapter'].getBalance(
          local.employeeId,
          local.locationId,
        );

        const hcmEquivalent = hcmBalances.find(
          (b) => b.leaveType === local.leaveType,
        );

        if (hcmEquivalent && hcmEquivalent.balance !== local.balance) {
          driftCount++;
          const previousBalance = local.balance;

          // Auto-correct
          local.balance = hcmEquivalent.balance;
          local.hcmVersion = hcmEquivalent.hcmVersion;
          local.lastSyncedAt = new Date();
          await this.balanceRepository.save(local);

          // Log drift exclusively
          await this.syncLogRepository.save(
            this.syncLogRepository.create({
              type: SyncLogType.DRIFT_CORRECT,
              triggeredBy: 'scheduled',
              status: 'SUCCESS',
              detail: JSON.stringify({
                employeeId: local.employeeId,
                leaveType: local.leaveType,
                driftAmount: Math.abs(hcmEquivalent.balance - previousBalance),
                previous: previousBalance,
                corrected: hcmEquivalent.balance,
              }),
            }),
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to analyze drift for ${local.employeeId}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Drift detection complete. Corrected ${driftCount} anomalies.`,
    );
  }
}
