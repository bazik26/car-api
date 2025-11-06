import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinColumn,
} from 'typeorm';
import { AdminEntity } from '../../db/admin.entity';
import { ProjectType } from '../../db/project-type';
import { LeadActivityEntity } from './lead-activity.entity';
import { LeadTaskEntity } from './lead-task.entity';
import { LeadTagEntity } from './lead-tag.entity';
import { LeadAttachmentEntity } from './lead-attachment.entity';
import { LeadMeetingEntity } from './lead-meeting.entity';

export enum LeadSource {
  CHAT = 'chat',
  TELEGRAM = 'telegram',
  PHONE = 'phone',
  EMAIL = 'email',
  OTHER = 'other',
}

export enum LeadStatus {
  NEW = 'new',
  IN_PROGRESS = 'in_progress',
  CONTACTED = 'contacted',
  CLOSED = 'closed',
  LOST = 'lost',
}

export enum LeadPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('leads')
export class LeadEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: LeadSource.CHAT,
  })
  source: LeadSource;

  @Column({
    type: 'varchar',
    length: 50,
    default: LeadStatus.NEW,
  })
  status: LeadStatus;

  @Column({
    type: 'varchar',
    length: 20,
    default: LeadPriority.NORMAL,
    nullable: true,
  })
  priority: LeadPriority;

  @Column({ type: 'boolean', default: false })
  hasTelegramContact: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  telegramUsername: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  chatSessionId: string;

  @Column({ type: 'int', nullable: true })
  assignedAdminId: number;

  @ManyToOne(() => AdminEntity, { nullable: true })
  @JoinColumn({ name: 'assignedAdminId' })
  assignedAdmin: AdminEntity;

  @Column({ type: 'enum', enum: ProjectType, nullable: true, default: ProjectType.OFFICE_1 })
  projectId: ProjectType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  projectSource: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @OneToMany(() => LeadCommentEntity, (comment) => comment.lead, { cascade: true })
  comments: LeadCommentEntity[];

  @OneToMany(() => LeadActivityEntity, (activity) => activity.lead, { cascade: true })
  activities: LeadActivityEntity[];

  @OneToMany(() => LeadTaskEntity, (task) => task.lead, { cascade: true })
  tasks: LeadTaskEntity[];

  @ManyToMany(() => LeadTagEntity, (tag) => tag.leads)
  tags: LeadTagEntity[];

  @OneToMany(() => LeadAttachmentEntity, (attachment) => attachment.lead, { cascade: true })
  attachments: LeadAttachmentEntity[];

  @OneToMany(() => LeadMeetingEntity, (meeting) => meeting.lead, { cascade: true })
  meetings: LeadMeetingEntity[];

  @Column({ type: 'int', default: 0 })
  score: number;

  @Column({ type: 'boolean', default: false })
  convertedToClient: boolean;

  @Column({ type: 'datetime', nullable: true })
  convertedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  lastContactedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  nextFollowUpDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('lead_comments')
export class LeadCommentEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  leadId: number;

  @ManyToOne(() => LeadEntity, (lead) => lead.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'leadId' })
  lead: LeadEntity;

  @Column({ type: 'int' })
  adminId: number;

  @ManyToOne(() => AdminEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'adminId' })
  admin: AdminEntity;

  @Column({ type: 'text' })
  comment: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

