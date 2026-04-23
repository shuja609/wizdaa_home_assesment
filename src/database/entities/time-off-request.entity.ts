import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

@Entity('time_off_requests')
export class TimeOffRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  employeeId: string;

  @Column()
  locationId: string;

  @Column()
  leaveType: string;

  @Column('date')
  startDate: string;

  @Column('date')
  endDate: string;

  @Column('real')
  days: number;

  @Column({
    type: 'text',
    default: RequestStatus.PENDING,
  })
  status: RequestStatus;

  @CreateDateColumn()
  requestedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt: Date;

  @Column({ nullable: true })
  managerId: string;

  @Column({ default: false })
  hcmSubmitted: boolean;

  @Column({ nullable: true })
  hcmError: string;

  @Column({ default: false })
  pendingConflict: boolean;
}
