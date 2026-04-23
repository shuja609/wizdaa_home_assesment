import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Balance } from '../database/entities/balance.entity';
import { HcmAdapter } from '../hcm/hcm.adapter';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BalancesService {
  private readonly logger = new Logger(BalancesService.name);
  private readonly syncThresholdMin: number;

  constructor(
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
    private readonly hcmAdapter: HcmAdapter,
    private readonly configService: ConfigService,
  ) {
    this.syncThresholdMin = this.configService.get<number>('HCM_SYNC_THRESHOLD_MIN', 5);
  }

  /**
   * Gets all balances for an employee at a location.
   * Checks local cache first; syncs from HCM if stale or missing.
   */
  async getBalances(employeeId: string, locationId: string): Promise<Balance[]> {
    const localBalances = await this.balanceRepository.find({
      where: { employeeId, locationId },
    });

    const isStale = localBalances.length === 0 || this.isStale(localBalances[0]);

    if (isStale) {
      this.logger.log(`Cache miss or stale for ${employeeId}. Syncing from HCM...`);
      return this.syncBalances(employeeId, locationId);
    }

    this.logger.log(`Serving cached balances for ${employeeId}`);
    return localBalances;
  }

  /**
   * Forces a synchronization with the HCM system.
   */
  async syncBalances(employeeId: string, locationId: string): Promise<Balance[]> {
    const hcmBalances = await this.hcmAdapter.getBalance(employeeId, locationId);
    
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

  async debitHcm(employeeId: string, locationId: string, leaveType: string, days: number) {
    const result = await this.hcmAdapter.debitBalance(employeeId, locationId, leaveType, days);
    if (result.success) {
      await this.balanceRepository.update(
        { employeeId, locationId, leaveType },
        { 
          balance: result.newBalance,
          lastSyncedAt: new Date(),
        }
      );
    }
    return result;
  }

  async creditHcm(employeeId: string, locationId: string, leaveType: string, days: number) {
    const result = await this.hcmAdapter.creditBalance(employeeId, locationId, leaveType, days);
    if (result.success) {
      await this.balanceRepository.update(
        { employeeId, locationId, leaveType },
        { 
          balance: result.newBalance,
          lastSyncedAt: new Date(),
        }
      );
    }
    return result;
  }
}
