import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Balance } from './database/entities/balance.entity';
import { TimeOffRequest } from './database/entities/time-off-request.entity';
import { SyncLog } from './database/entities/sync-log.entity';
import { BalancesModule } from './balances/balances.module';
import { RequestsModule } from './requests/requests.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    BalancesModule,
    RequestsModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'sqlite',
        database: configService.get<string>('DB_FILE', 'database.sqlite'),
        entities: [Balance, TimeOffRequest, SyncLog],
        synchronize: true, // Only for development; would use migrations for production
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
