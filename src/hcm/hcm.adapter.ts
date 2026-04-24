import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Adapter module responsible for all outbound communications with the external HCM system.
 * Acts as an Anti-Corruption Layer (ACL) to shield the domain from external API changes.
 * Includes timeout and error normalization logic.
 */
@Injectable()
export class HcmAdapter {
  private readonly logger = new Logger(HcmAdapter.name);
  private readonly hcmUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.hcmUrl = this.configService.get<string>(
      'HCM_API_URL',
      'http://localhost:3001',
    );
  }

  /**
   * Helper to perform HTTP fetches with a mandatory timeout.
   */
  private async fetchWithTimeout(url: string, options: any, timeoutMs = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(id);
      return response;
    } catch (err: any) {
      clearTimeout(id);
      if (err.name === 'AbortError') {
        throw new ServiceUnavailableException('HCM System timeout');
      }
      throw new ServiceUnavailableException(
        `HCM System unavailable: ${err.message}`,
      );
    }
  }

  /**
   * Retrieves leave balances from HCM.
   * Iterates through supported leave types to build a complete local view.
   */
  async getBalance(employeeId: string, locationId: string): Promise<any[]> {
    this.logger.log(
      `Fetching balance from HCM for ${employeeId} at ${locationId}`,
    );
    const types = ['annual', 'sick'];
    const results: any[] = [];
    for (const type of types) {
      try {
        const res = await this.fetchWithTimeout(
          `${this.hcmUrl}/hcm/balance/${employeeId}/${locationId}/${type}`,
          { method: 'GET' },
        );
        if (res.ok) {
          const data = await res.json();
          results.push(data);
        }
      } catch (error: any) {
        this.logger.error(`HCM fetch error for ${type}: ${error.message}`);
        // PRD: All calls time out in 5s; on timeout, throw HcmUnavailableException
        if (error.message.includes('timeout')) {
          throw error;
        }
        // Partial failures are handled by returning the results collected so far.
      }
    }
    return results;
  }

  /**
   * Pushes a debit request to HCM.
   * Atomic operation to reduce authoritative balance.
   */
  async debitBalance(
    employeeId: string,
    locationId: string,
    leaveType: string,
    days: number,
  ): Promise<any> {
    this.logger.log(`Debiting ${days} days from HCM for ${employeeId}`);
    const res = await this.fetchWithTimeout(
      `${this.hcmUrl}/hcm/balance/debit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, locationId, leaveType, days }),
      },
    );
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to debit HCM' };
    }
    return data;
  }

  /**
   * Pushes a credit request to HCM (usually for rollbacks).
   */
  async creditBalance(
    employeeId: string,
    locationId: string,
    leaveType: string,
    days: number,
  ): Promise<any> {
    this.logger.log(`Crediting ${days} days to HCM for ${employeeId}`);
    const res = await this.fetchWithTimeout(
      `${this.hcmUrl}/hcm/balance/credit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, locationId, leaveType, days }),
      },
    );
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to credit HCM' };
    }
    return data;
  }
}
