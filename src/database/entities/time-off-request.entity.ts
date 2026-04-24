import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/** Lifecycle stages of a Time-Off Request */
export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/**
 * Core Domain Entity representing a time-off submission.
 * Captures the request window, employee metadata, and manager resolutions.
 */
@Entity('time_off_requests')
export class TimeOffRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Authoritative Employee ID */
  @Index()
  @Column()
  employeeId: string;

  /** Home location ID */
  @Column()
  locationId: string;

  /** Desired leave type */
  @Column()
  leaveType: string;

  @Column()
  startDate: Date;

  @Column()
  endDate: Date;

  /** Calculated duration in business days (weekends excluded) */
  @Column('float')
  days: number;

  @Column({
    type: 'simple-enum',
    enum: RequestStatus,
    default: RequestStatus.PENDING,
  })
  status: RequestStatus;

  /** ID of the manager who resolved the request */
  @Column({ nullable: true })
  managerId: string;

  /** Standard note accompanying the request */
  @Column({ nullable: true })
  note: string;

  /** Flag indicating if the request conflicts with a recently pushed HCM batch */
  @Column({ default: false })
  pendingConflict: boolean;

  /** Confirmation flag that the debit was successfully transmitted to HCM */
  @Column({ default: false })
  hcmSubmitted: boolean;

  /** Capture of any error messages returned by the authoritative HCM API */
  @Column({ type: 'text', nullable: true })
  hcmError: string;

  @CreateDateColumn()
  requestedAt: Date;

  /** Timestamp of approval or rejection */
  @Column({ nullable: true })
  resolvedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
