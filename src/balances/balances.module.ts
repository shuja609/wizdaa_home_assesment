import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Balance } from '../database/entities/balance.entity';
import { TimeOffRequest } from '../database/entities/time-off-request.entity';
import { SyncLog } from '../database/entities/sync-log.entity';
import { BalancesService } from './balances.service';
import { BalancesController } from './balances.controller';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { HcmModule } from '../hcm/hcm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Balance, TimeOffRequest, SyncLog]),
    HcmModule,
  ],
  controllers: [BalancesController, SyncController],
  providers: [BalancesService, SyncService],
  exports: [BalancesService],
})
export class BalancesModule {}
