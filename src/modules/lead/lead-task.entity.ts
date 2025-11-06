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

export enum TaskType {
  CONTACT = 'contact', // Связаться с клиентом
  REGISTER_LEAD = 'register_lead', // Оформить лида
  CAR_PREFERENCES = 'car_preferences', // Узнать желаемую выборку по машинам
  REGION = 'region', // Регион
  BUDGET = 'budget', // Бюджет
  ADDITIONAL_INFO = 'additional_info', // Дополнительная информация
}

export enum TaskStatus {
  PENDING = 'pending', // Ожидает выполнения
  IN_PROGRESS = 'in_progress', // В работе
  COMPLETED = 'completed', // Выполнена
}

@Entity('lead_tasks')
export class LeadTaskEntity {
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

  @Column({ type: 'enum', enum: TaskType })
  taskType: TaskType;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.PENDING })
  status: TaskStatus;

  @Column({ type: 'datetime', nullable: true })
  dueDate: Date;

  @Column({ type: 'boolean', default: false })
  completed: boolean;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date;

  // Данные задачи (JSON для хранения структурированной информации)
  @Column({ type: 'json', nullable: true })
  taskData?: {
    // Для CONTACT
    contactMethod?: string; // 'phone' | 'email' | 'telegram'
    contactResult?: string; // Результат контакта
    
    // Для CAR_PREFERENCES
    preferredBrands?: string[];
    preferredModels?: string[];
    preferredYearFrom?: number;
    preferredYearTo?: number;
    preferredMileageMax?: number;
    
    // Для REGION
    region?: string;
    city?: string;
    
    // Для BUDGET
    budgetMin?: number;
    budgetMax?: number;
    currency?: string; // 'RUB' | 'USD' | 'EUR'
    
    // Для ADDITIONAL_INFO
    additionalNotes?: string;
    urgency?: 'low' | 'medium' | 'high';
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}



