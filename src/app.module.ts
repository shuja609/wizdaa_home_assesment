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
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { EventEmitterModule } from '@nestjs/event-emitter';

/**
 * Root Application Module.
 * Responsible for orchestrating global concerns including:
 * - Environment Configuration (ConfigModule)
 * - Persistance (TypeORM with SQLite)
 * - Security (JWT, Throttling)
 * - Observability (Pino)
 * - Scheduling (Cron jobs)
 * - Internal Event Bus (EventEmitter2)
 */
@Module({
  imports: [
    // 1. Initialize Global Event Bus
    EventEmitterModule.forRoot(),

    // 2. Load Environment Variables
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // 3. Configure Structured JSON logging
    LoggerModule.forRoot({
      pinoHttp: {
        transport: {
          target: 'pino-pretty',
          options: {
            singleLine: true,
          },
        },
      },
    }),

    // 4. Global Rate Limiter
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // 5. Shared JWT Configuration for Authentication
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'test-jwt-secret'),
        signOptions: { expiresIn: '1h' },
      }),
      inject: [ConfigService],
    }),

    // 6. Enable Scheduled Tasks
    ScheduleModule.forRoot(),

    // 7. Core Feature Modules
    BalancesModule,
    RequestsModule,

    // 8. Database Persistence Layer
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'sqlite',
        database: configService.get<string>('DB_FILE', 'database.sqlite'),
        entities: [Balance, TimeOffRequest, SyncLog],
        synchronize: true, // Auto-schema generation (Development mode)
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Enable Global Throttling across all endpoints by default
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
