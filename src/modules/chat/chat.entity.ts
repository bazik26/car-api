import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AdminEntity } from '../../db/admin.entity';

@Entity('chat_messages')
export class ChatMessageEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  sessionId: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 50 })
  senderType: 'client' | 'admin';

  @Column({ type: 'varchar', length: 255, nullable: true })
  clientName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  clientEmail: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  clientPhone: string;

  @Column({ type: 'int', nullable: true })
  adminId: number;

  @ManyToOne(() => AdminEntity, { nullable: true })
  @JoinColumn({ name: 'adminId' })
  admin: AdminEntity;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  projectSource: string; // car-client, car-market-client, etc.

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('chat_sessions')
export class ChatSessionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  sessionId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  clientName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  clientEmail: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  clientPhone: string;

  @Column({ type: 'varchar', length: 255 })
  projectSource: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', nullable: true })
  assignedAdminId: number;

  @ManyToOne(() => AdminEntity, { nullable: true })
  @JoinColumn({ name: 'assignedAdminId' })
  assignedAdmin: AdminEntity;

  @Column({ type: 'timestamp', nullable: true })
  lastMessageAt: Date;

  @Column({ type: 'int', default: 0 })
  unreadCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
