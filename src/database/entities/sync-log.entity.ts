import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

export enum SyncLogType {
  BATCH = 'BATCH',
  REALTIME = 'REALTIME',
  DRIFT_CORRECT = 'DRIFT_CORRECT',
}

@Entity('sync_logs')
export class SyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  type: SyncLogType;

  @Column()
  triggeredBy: string; // scheduled | webhook | request

  @Column()
  status: string; // SUCCESS | PARTIAL | FAILED

  @Column('text', { nullable: true })
  detail: string; // JSON string

  @CreateDateColumn()
  createdAt: Date;
}
