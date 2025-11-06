import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LeadEntity } from './lead.entity';
import { AdminEntity } from '../../db/admin.entity';

export enum MeetingType {
  CALL = 'call',
  EMAIL = 'email',
  MEETING = 'meeting',
  VISIT = 'visit',
  OTHER = 'other',
}

@Entity('lead_meetings')
export class LeadMeetingEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  leadId: number;

  @ManyToOne(() => LeadEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'leadId' })
  lead: LeadEntity;

  @Column({ type: 'int' })
  adminId: number;

  @ManyToOne(() => AdminEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'adminId' })
  admin: AdminEntity;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'datetime' })
  meetingDate: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string;

  @Column({ type: 'varchar', length: 50, default: MeetingType.CALL })
  meetingType: MeetingType;

  @Column({ type: 'boolean', default: false })
  completed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}



