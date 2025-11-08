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
  // Этап 1: Первый контакт
  FIRST_CONTACT = 'first_contact', // Первый звонок (0-2 часа)
  
  // Этап 2: Квалификация
  QUALIFICATION = 'qualification', // Квалификация лида (2-24 часа)
  COLLECT_CONTACTS = 'collect_contacts', // Собрать все контакты
  
  // Этап 3: Выявление потребностей
  CAR_PREFERENCES = 'car_preferences', // Узнать предпочтения по авто
  BUDGET = 'budget', // Узнать бюджет
  REGION = 'region', // Узнать регион доставки
  TIMELINE = 'timeline', // Узнать сроки покупки
  
  // Этап 4: Презентация
  SEND_OFFERS = 'send_offers', // Отправить подборку авто
  SEND_CALCULATION = 'send_calculation', // Отправить расчет стоимости
  SEND_PHOTOS = 'send_photos', // Отправить фото/видео авто
  
  // Этап 5: Работа с возражениями
  FOLLOW_UP = 'follow_up', // Повторная связь
  OBJECTION_HANDLING = 'objection_handling', // Работа с возражениями
  ADDITIONAL_INFO = 'additional_info', // Доп. информация
  
  // Этап 6: Закрытие сделки
  SCHEDULE_MEETING = 'schedule_meeting', // Назначить встречу
  SEND_CONTRACT = 'send_contract', // Отправить договор
  CONFIRM_DEAL = 'confirm_deal', // Подтвердить сделку
  GET_PREPAYMENT = 'get_prepayment', // Получить предоплату
  
  // Старые (для обратной совместимости)
  CONTACT = 'contact', // Связаться с клиентом
  REGISTER_LEAD = 'register_lead', // Оформить лида
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



