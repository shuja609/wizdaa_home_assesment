import { Injectable, Logger } from '@nestjs/common';

export interface HcmBalance {
  leaveType: string;
  balance: number;
  hcmVersion: string;
}

@Injectable()
export class HcmAdapter {
  private readonly logger = new Logger(HcmAdapter.name);

  /**
   * Fetches a balance from the external HCM system.
   * Currently mocked until Sprint 4.
   */
  async getBalance(
    employeeId: string,
    locationId: string,
  ): Promise<HcmBalance[]> {
    this.logger.log(`Fetching balances from HCM for employee ${employeeId} at ${locationId}`);
    
    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Mock response based on employeeId
    if (employeeId === 'notfound') {
      return [];
    }

    return [
      {
        leaveType: 'annual',
        balance: 20.0,
        hcmVersion: `v-${Date.now()}`,
      },
      {
        leaveType: 'sick',
        balance: 10.0,
        hcmVersion: `v-${Date.now()}`,
      },
    ];
  }

  async debitBalance(
    employeeId: string,
    locationId: string,
    leaveType: string,
    days: number,
  ): Promise<{ success: boolean; newBalance: number }> {
    this.logger.log(`Debiting HCM balance for ${employeeId}: -${days} days of ${leaveType}`);
    return { success: true, newBalance: 15.0 }; // Mocked
  }

  async creditBalance(
    employeeId: string,
    locationId: string,
    leaveType: string,
    days: number,
  ): Promise<{ success: boolean; newBalance: number }> {
    this.logger.log(`Crediting HCM balance for ${employeeId}: +${days} days of ${leaveType}`);
    return { success: true, newBalance: 25.0 }; // Mocked
  }
}
