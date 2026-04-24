import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

/** Supported Synchronization operation types */
export enum SyncLogType {
  /** Large batch update pushed from HCM via webhook */
  BATCH = 'BATCH',
  /** Individual record sync triggered via real-time logic */
  REALTIME = 'REALTIME',
  /** Scheduled drift correction correction task */
  DRIFT_CORRECT = 'DRIFT_CORRECT',
}

/**
 * Entity for auditing the health and performance of the Synchronization system.
 * Captures successes, partial failures, and numerical drift anomalies.
 */
@Entity('sync_logs')
export class SyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Operation category (BATCH, REALTIME, or DRIFT) */
  @Column()
  type: SyncLogType;

  /** Trigger source (scheduled | webhook | user) */
  @Column()
  triggeredBy: string;

  /** Final outcome (SUCCESS | PARTIAL | FAILED) */
  @Column()
  status: string;

  /** JSON metadata containing specific counts or error details */
  @Column('text', { nullable: true })
  detail: string;

  @CreateDateColumn()
  createdAt: Date;
}
