import { Controller, Post, Body, Get, UnauthorizedException, Headers } from '@nestjs/common';
import { BalancesService } from './balances.service';
import { HcmBatchDto } from '../hcm/dto/hcm-batch.dto';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncLog } from '../database/entities/sync-log.entity';

@Controller('hcm')
export class SyncController {
  constructor(
    private readonly balancesService: BalancesService,
    private readonly configService: ConfigService,
    @InjectRepository(SyncLog)
    private readonly syncLogRepository: Repository<SyncLog>,
  ) {}

  @Post('batch')
  async processBatch(
    @Body() batchDto: HcmBatchDto,
    @Headers('x-hcm-secret') secret: string,
  ) {
    const expectedSecret = this.configService.get<string>('HCM_SHARED_SECRET');
    if (!expectedSecret || secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid or missing HCM secret');
    }

    return this.balancesService.processBatchUpdate(batchDto);
  }

  @Get('sync-status')
  async getSyncStatus() {
    const logs = await this.syncLogRepository.find({
      order: { createdAt: 'DESC' },
      take: 10,
    });
    return { recentLogs: logs };
  }
}
