import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('balances')
export class Balance {
  @PrimaryColumn()
  employeeId: string;

  @PrimaryColumn()
  locationId: string;

  @PrimaryColumn()
  leaveType: string;

  @Column('real')
  balance: number;

  @Column({ nullable: true })
  hcmVersion: string;

  @Column('datetime')
  lastSyncedAt: Date;
}
