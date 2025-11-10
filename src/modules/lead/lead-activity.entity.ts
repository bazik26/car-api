import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LeadEntity } from './lead.entity';
import { AdminEntity } from '../../db/admin.entity';

export enum ActivityType {
  CREATED = 'created',
  UPDATED = 'updated',
  STATUS_CHANGED = 'status_changed',
  PRIORITY_CHANGED = 'priority_changed',
  ASSIGNED = 'assigned',
  COMMENT_ADDED = 'comment_added',
  TASK_CREATED = 'task_created',
  TASK_COMPLETED = 'task_completed',
  TAG_ADDED = 'tag_added',
  TAG_REMOVED = 'tag_removed',
  FILE_ATTACHED = 'file_attached',
  MEETING_SCHEDULED = 'meeting_scheduled',
  CONVERTED = 'converted',
}

@Entity('lead_activities')
export class LeadActivityEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  leadId: number;

  @ManyToOne(() => LeadEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'leadId' })
  lead: LeadEntity;

  @Column({ type: 'int', nullable: true })
  adminId: number;

  @ManyToOne(() => AdminEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'adminId' })
  admin: AdminEntity;

  @Column({ type: 'varchar', length: 50 })
  activityType: ActivityType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  field: string;

  @Column({ type: 'text', nullable: true })
  oldValue: string;

  @Column({ type: 'text', nullable: true })
  newValue: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;
}








