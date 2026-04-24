import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Balance } from '../database/entities/balance.entity';
import { SyncLog, SyncLogType } from '../database/entities/sync-log.entity';
import { BalancesService } from './balances.service';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  TimeOffRequest,
  RequestStatus,
} from '../database/entities/time-off-request.entity';

/**
 * Service managing recurring synchronization tasks and drift detection.
 * Enforces consistency between the microservice's state and the external HCM system.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
    @InjectRepository(TimeOffRequest)
    private readonly requestRepository: Repository<TimeOffRequest>,
    @InjectRepository(SyncLog)
    private readonly syncLogRepository: Repository<SyncLog>,
    private readonly balancesService: BalancesService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Scheduled job to detect numerical drift between local cache and HCM.
   * Corrects discrepancies and alerts managers if drifts occur during active PENDING requests.
   * Run frequency: Hourly (Configurable via code).
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleDriftDetection() {
    this.logger.log('Starting scheduled drift detection...');

    // Load all local balance records for cross-verification.
    const allLocalBalances = await this.balanceRepository.find();
    let driftCount = 0;

    for (const local of allLocalBalances) {
      try {
        // Fetch current state from the external HCM adapter.
        const hcmBalances = await this.balancesService['hcmAdapter'].getBalance(
          local.employeeId,
          local.locationId,
        );

        const hcmEquivalent = hcmBalances.find(
          (b) => b.leaveType === local.leaveType,
        );

        // Check for numerical drift beyond floating-point epsilon.
        if (
          hcmEquivalent &&
          Math.abs(hcmEquivalent.balance - local.balance) > 0.001
        ) {
          driftCount++;
          const previousBalance = local.balance;

          // Auto-correction: Sync local state with HCM ground truth.
          local.balance = hcmEquivalent.balance;
          local.hcmVersion = hcmEquivalent.hcmVersion;
          local.lastSyncedAt = new Date();
          await this.balanceRepository.save(local);

          // F3.2: Emit internal event for downstream subscribers (audit/analytics).
          this.eventEmitter.emit('balance.drift', {
            employeeId: local.employeeId,
            locationId: local.locationId,
            leaveType: local.leaveType,
            previous: previousBalance,
            current: local.balance,
          });

          // F3.2: Alerting logic for high-risk drifts (occurring mid-request).
          const pendingCount = await this.requestRepository.count({
            where: {
              employeeId: local.employeeId,
              locationId: local.locationId,
              leaveType: local.leaveType,
              status: RequestStatus.PENDING,
            },
          });

          if (pendingCount > 0) {
            this.logger.warn(
              `ALERT: Drift detected on ${local.employeeId} while ${pendingCount} requests are PENDING. Manual review recommended.`,
            );
          }

          // Persist a specialized drift log entry.
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
                pendingAffected: pendingCount,
              }),
            }),
          );
        }
      } catch (error: any) {
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
