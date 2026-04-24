import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Metadata Entity to store and track leave balances for employees.
 * Acts as a local cache for high-performance retrieval and resilient request submission.
 */
@Entity('balances')
@Index(['employeeId', 'locationId', 'leaveType'], { unique: true })
export class Balance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Authoritative Employee ID from HCM */
  @Column()
  employeeId: string;

  /** Workplace location identifier */
  @Column()
  locationId: string;

  /** Type of leave (e.g., 'annual', 'sick') */
  @Column()
  leaveType: string;

  /** Current numerical balance in days */
  @Column('float')
  balance: number;

  /**
   * Last known version identifier from HCM.
   * Used for concurrency and tracking authoritative updates.
   */
  @Column({ default: 0 })
  hcmVersion: number;

  /** Timestamp of the last successful synchronization with the external system */
  @Column()
  lastSyncedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
