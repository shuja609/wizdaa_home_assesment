import {
  Controller,
  Post,
  Body,
  Get,
  UnauthorizedException,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { BalancesService } from './balances.service';
import { HcmBatchDto } from '../hcm/dto/hcm-batch.dto';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { SyncLog, SyncLogType } from '../database/entities/sync-log.entity';
import { AuthGuard } from '../common/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  TimeOffRequest,
  RequestStatus,
} from '../database/entities/time-off-request.entity';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiHeader,
  ApiResponse,
} from '@nestjs/swagger';

/**
 * Controller for HCM Inbound communication and Sync Health monitoring.
 * Handles authoritative batch updates from the external HCM system via webhooks.
 */
@ApiTags('Balances & Sync')
@Controller('hcm')
export class SyncController {
  constructor(
    private readonly balancesService: BalancesService,
    private readonly configService: ConfigService,
    @InjectRepository(SyncLog)
    private readonly syncLogRepository: Repository<SyncLog>,
    @InjectRepository(TimeOffRequest)
    private readonly requestRepository: Repository<TimeOffRequest>,
  ) {}

  /**
   * Authoritative batch update endpoint for HCM Sync.
   * Secured via a shared HCM secret header.
   */
  @ApiOperation({ summary: 'Authoritative batch update from HCM (Webhook)' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Roles('hcm_system')
  @ApiHeader({
    name: 'x-hcm-secret',
    description: 'Authoritative shared secret for HCM communications',
    required: true,
  })
  @ApiResponse({ status: 201, description: 'Batch processed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or missing secret' })
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

  /**
   * Retrieves high-level health metrics for the Synchronization engine.
   * Returns: last batch time, last drift time, and unresolved conflict counts.
   * Access restricted to Managers.
   */
  @ApiOperation({
    summary: 'Get synchronization health metrics (Manager Only)',
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Roles('manager')
  @Get('sync-status')
  async getSyncStatus() {
    const lastBatch = await this.syncLogRepository.findOne({
      where: { type: SyncLogType.BATCH },
      order: { createdAt: 'DESC' },
    });

    const lastDrift = await this.syncLogRepository.findOne({
      where: { type: SyncLogType.DRIFT_CORRECT },
      order: { createdAt: 'DESC' },
    });

    const unresolvedConflicts = await this.requestRepository.count({
      where: { pendingConflict: true, status: RequestStatus.PENDING },
    });

    const driftedSinceLastBatch = await this.syncLogRepository.count({
      where: {
        type: SyncLogType.DRIFT_CORRECT,
        createdAt: MoreThan(lastBatch?.createdAt || new Date(0)),
      },
    });

    return {
      lastBatchSync: lastBatch?.createdAt || null,
      lastDriftCheck: lastDrift?.createdAt || null,
      driftedRecordsSinceLastBatch: driftedSinceLastBatch,
      unresolvedConflicts,
      recentLogs: await this.syncLogRepository.find({
        order: { createdAt: 'DESC' },
        take: 5,
      }),
    };
  }
}
