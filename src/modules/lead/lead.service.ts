import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { LeadEntity, LeadCommentEntity, LeadSource, LeadStatus, LeadPriority } from './lead.entity';
import { AdminEntity } from '../../db/admin.entity';
import { ProjectType } from '../../db/project-type';
import { ChatSessionEntity } from '../chat/chat.entity';
import { LeadActivityEntity, ActivityType } from './lead-activity.entity';
import { LeadTaskEntity, TaskType, TaskStatus } from './lead-task.entity';
import { LeadTagEntity } from './lead-tag.entity';
import { LeadAttachmentEntity } from './lead-attachment.entity';
import { LeadMeetingEntity, MeetingType } from './lead-meeting.entity';

export interface CreateLeadDto {
  name: string;
  email?: string;
  phone?: string;
  source?: LeadSource;
  status?: LeadStatus;
  priority?: LeadPriority;
  hasTelegramContact?: boolean;
  telegramUsername?: string;
  chatSessionId?: string;
  assignedAdminId?: number;
  description?: string;
  projectSource?: string;
}

export interface UpdateLeadDto {
  name?: string;
  email?: string;
  phone?: string;
  source?: LeadSource;
  status?: LeadStatus;
  priority?: LeadPriority;
  hasTelegramContact?: boolean;
  telegramUsername?: string;
  assignedAdminId?: number;
  description?: string;
  projectId?: ProjectType;
}

export interface CreateLeadCommentDto {
  leadId: number;
  adminId: number;
  comment: string;
}

@Injectable()
export class LeadService {
  constructor(
    @InjectRepository(LeadEntity)
    private leadRepository: Repository<LeadEntity>,
    @InjectRepository(LeadCommentEntity)
    private leadCommentRepository: Repository<LeadCommentEntity>,
    @InjectRepository(AdminEntity)
    private adminRepository: Repository<AdminEntity>,
    @InjectRepository(ChatSessionEntity)
    private chatSessionRepository: Repository<ChatSessionEntity>,
    @InjectRepository(LeadActivityEntity)
    private leadActivityRepository: Repository<LeadActivityEntity>,
    @InjectRepository(LeadTaskEntity)
    private leadTaskRepository: Repository<LeadTaskEntity>,
    @InjectRepository(LeadTagEntity)
    private leadTagRepository: Repository<LeadTagEntity>,
    @InjectRepository(LeadAttachmentEntity)
    private leadAttachmentRepository: Repository<LeadAttachmentEntity>,
    @InjectRepository(LeadMeetingEntity)
    private leadMeetingRepository: Repository<LeadMeetingEntity>,
  ) {}

  // Создать лид
  async createLead(createLeadDto: CreateLeadDto, adminId?: number, admin?: AdminEntity): Promise<LeadEntity> {
    // Устанавливаем projectId и projectSource на основе админа
    const projectId = admin?.projectId || ProjectType.OFFICE_1;
    // projectSource может быть передан явно (например, из чата) или берется из админа
    const projectSource = createLeadDto.projectSource || (admin?.projectId === ProjectType.OFFICE_1 ? 'office_1' : admin?.projectId === ProjectType.OFFICE_1 ? 'office_2' : 'manual');
    
    const lead = this.leadRepository.create({
      ...createLeadDto,
      projectId,
      projectSource,
    });
    const savedLead = await this.leadRepository.save(lead);

    // Создаем активность
    if (adminId) {
      await this.createActivity({
        leadId: savedLead.id,
        adminId,
        activityType: ActivityType.CREATED,
        description: 'Лид создан',
      });
    }

    // Автоматически создаем задачи для обработки лида
    await this.createDefaultTasksForLead(savedLead.id, savedLead.assignedAdminId || adminId);

    // Рассчитываем score
    await this.calculateLeadScore(savedLead.id);

    return savedLead;
  }

  // Создать лид из чат-сессии
  async createLeadFromChatSession(
    chatSessionId: string,
    assignedAdminId?: number,
  ): Promise<LeadEntity> {
    const session = await this.chatSessionRepository.findOne({
      where: { sessionId: chatSessionId },
    });

    if (!session) {
      throw new NotFoundException(`Chat session with ID ${chatSessionId} not found`);
    }

    // Проверяем, не создан ли уже лид для этой сессии
    const existingLead = await this.leadRepository.findOne({
      where: { chatSessionId },
    });

    if (existingLead) {
      return existingLead;
    }

    const lead = this.leadRepository.create({
      name: session.clientName || 'Неизвестный клиент',
      email: session.clientEmail,
      phone: session.clientPhone,
      source: LeadSource.CHAT,
      status: LeadStatus.NEW,
      priority: LeadPriority.NORMAL,
      chatSessionId: session.sessionId,
      assignedAdminId: assignedAdminId || session.assignedAdminId || undefined,
      projectId: session.projectId || ProjectType.OFFICE_1, // Используем projectId из сессии или дефолт
      projectSource: session.projectSource || 'chat', // Используем projectSource из сессии
    });

    const savedLead = await this.leadRepository.save(lead);

    // Автоматически создаем задачи для обработки лида
    await this.createDefaultTasksForLead(savedLead.id, savedLead.assignedAdminId || assignedAdminId);

    return savedLead;
  }

  // Получить все лиды
  async getAllLeads(
    filters?: {
      status?: LeadStatus;
      source?: LeadSource;
      assignedAdminId?: number;
      search?: string;
    },
    admin?: AdminEntity,
  ): Promise<LeadEntity[]> {
    const queryBuilder = this.leadRepository
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.assignedAdmin', 'admin')
      .leftJoinAndSelect('lead.comments', 'comments')
      .leftJoinAndSelect('comments.admin', 'commentAdmin')
      .orderBy('lead.createdAt', 'DESC');

    // Для не-суперадминов фильтруем по projectId
    if (admin && !admin.isSuper && admin.projectId) {
      queryBuilder.andWhere('lead.projectId = :projectId', { projectId: admin.projectId });
    }

    if (filters?.status) {
      queryBuilder.andWhere('lead.status = :status', { status: filters.status });
    }

    if (filters?.source) {
      queryBuilder.andWhere('lead.source = :source', { source: filters.source });
    }

    if (filters?.assignedAdminId) {
      queryBuilder.andWhere('lead.assignedAdminId = :assignedAdminId', {
        assignedAdminId: filters.assignedAdminId,
      });
    }

    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      queryBuilder.andWhere(
        '(lead.name LIKE :search OR lead.email LIKE :search OR lead.phone LIKE :search)',
        { search: searchTerm },
      );
    }

    return await queryBuilder.getMany();
  }

  // Получить лид по ID
  async getLeadById(id: number): Promise<LeadEntity> {
    const lead = await this.leadRepository.findOne({
      where: { id },
      relations: [
        'assignedAdmin',
        'comments',
        'comments.admin',
        'tags',
        'tasks',
        'tasks.admin',
        'attachments',
        'attachments.admin',
        'meetings',
        'meetings.admin',
        'activities',
        'activities.admin',
      ],
      order: {
        comments: { createdAt: 'ASC' },
        activities: { createdAt: 'DESC' },
        tasks: { createdAt: 'DESC' },
        meetings: { meetingDate: 'ASC' },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    return lead;
  }

  // Обновить лид
  async updateLead(
    id: number,
    updateLeadDto: UpdateLeadDto,
    adminId?: number,
    admin?: AdminEntity,
  ): Promise<LeadEntity> {
    const lead = await this.getLeadById(id);
    
    // Для не-суперадминов проверяем, что лид принадлежит их офису
    if (admin && !admin.isSuper) {
      if (lead.projectId !== admin.projectId) {
        throw new Error('Нет доступа к редактированию этого лида');
      }
      // Всегда устанавливаем projectId на основе админа (безопасность)
      updateLeadDto.projectId = admin.projectId || ProjectType.OFFICE_1;
    }
    
    const oldValues = { ...lead };

    Object.assign(lead, updateLeadDto);

    const updatedLead = await this.leadRepository.save(lead);

    // Пересчитываем score
    await this.calculateLeadScore(id);

    // Создаем записи в истории изменений
    if (adminId) {
      const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

      Object.keys(updateLeadDto).forEach((key) => {
        if (oldValues[key] !== updateLeadDto[key]) {
          changes.push({
            field: key,
            oldValue: oldValues[key]?.toString() || null,
            newValue: updateLeadDto[key]?.toString() || null,
          });
        }
      });

      for (const change of changes) {
        await this.createActivity({
          leadId: id,
          adminId,
          activityType:
            change.field === 'status'
              ? ActivityType.STATUS_CHANGED
              : change.field === 'priority'
                ? ActivityType.PRIORITY_CHANGED
                : change.field === 'assignedAdminId'
                  ? ActivityType.ASSIGNED
                  : ActivityType.UPDATED,
          field: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
        });
      }
    }

    return updatedLead;
  }

  // Удалить лид
  async deleteLead(id: number, admin?: AdminEntity): Promise<void> {
    const lead = await this.getLeadById(id);
    
    // Для не-суперадминов проверяем, что лид принадлежит их офису
    if (admin && !admin.isSuper) {
      if (lead.projectId !== admin.projectId) {
        throw new Error('Нет доступа к удалению этого лида');
      }
    }
    
    await this.leadRepository.remove(lead);
  }

  // Создать комментарий к лиду
  async createComment(
    createCommentDto: CreateLeadCommentDto,
  ): Promise<LeadCommentEntity> {
    const lead = await this.getLeadById(createCommentDto.leadId);

    const comment = this.leadCommentRepository.create({
      leadId: createCommentDto.leadId,
      adminId: createCommentDto.adminId,
      comment: createCommentDto.comment,
    });

    return await this.leadCommentRepository.save(comment);
  }

  // Получить комментарии лида
  async getLeadComments(leadId: number): Promise<LeadCommentEntity[]> {
    return await this.leadCommentRepository.find({
      where: { leadId },
      relations: ['admin'],
      order: { createdAt: 'ASC' },
    });
  }

  // Удалить комментарий
  async deleteComment(commentId: number): Promise<void> {
    const comment = await this.leadCommentRepository.findOne({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${commentId} not found`);
    }

    await this.leadCommentRepository.remove(comment);
  }

  // Получить статистику лидов
  async getLeadsStats() {
    const total = await this.leadRepository.count();
    const byStatus = await this.leadRepository
      .createQueryBuilder('lead')
      .select('lead.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('lead.status')
      .getRawMany();

    const bySource = await this.leadRepository
      .createQueryBuilder('lead')
      .select('lead.source', 'source')
      .addSelect('COUNT(*)', 'count')
      .groupBy('lead.source')
      .getRawMany();

    return {
      total,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = parseInt(item.count);
        return acc;
      }, {}),
      bySource: bySource.reduce((acc, item) => {
        acc[item.source] = parseInt(item.count);
        return acc;
      }, {}),
    };
  }

  async getUnprocessedLeadsCount(admin?: AdminEntity): Promise<number> {
    // Необработанные лиды: высокий score (>= 50) или не назначены админу, статус new или in_progress
    const queryBuilder = this.leadRepository
      .createQueryBuilder('lead')
      .where('(lead.score >= :minScore OR lead.assignedAdminId IS NULL)', { minScore: 50 })
      .andWhere('(lead.status = :statusNew OR lead.status = :statusInProgress)', {
        statusNew: LeadStatus.NEW,
        statusInProgress: LeadStatus.IN_PROGRESS,
      });

    // Для не-суперадминов фильтруем по projectId
    if (admin && !admin.isSuper && admin.projectId) {
      queryBuilder.andWhere('lead.projectId = :projectId', { projectId: admin.projectId });
    }

    return await queryBuilder.getCount();
  }

  // ==================== ACTIVITY LOG ====================

  async createActivity(data: {
    leadId: number;
    adminId?: number;
    activityType: ActivityType;
    field?: string;
    oldValue?: string;
    newValue?: string;
    description?: string;
  }): Promise<LeadActivityEntity> {
    const activity = this.leadActivityRepository.create(data);
    return await this.leadActivityRepository.save(activity);
  }

  async getLeadActivities(leadId: number): Promise<LeadActivityEntity[]> {
    return await this.leadActivityRepository.find({
      where: { leadId },
      relations: ['admin'],
      order: { createdAt: 'DESC' },
    });
  }

  // ==================== TASKS ====================

  // Автоматически создаем задачи для обработки нового лида
  async createDefaultTasksForLead(leadId: number, adminId?: number): Promise<void> {
    if (!adminId) {
      // Если админ не назначен, не создаем задачи
      return;
    }

    const lead = await this.getLeadById(leadId);
    if (!lead) {
      return;
    }

    // Определяем дедлайн для задач (через 24 часа)
    const dueDate = new Date();
    dueDate.setHours(dueDate.getHours() + 24);

    // Список задач для создания
    const defaultTasks = [
      {
        leadId,
        adminId,
        title: 'Связаться с клиентом',
        description: 'Связаться с клиентом по телефону, email или Telegram',
        taskType: TaskType.CONTACT,
        status: TaskStatus.PENDING,
        dueDate,
        taskData: {
          contactMethod: null,
          contactResult: null,
        },
      },
      {
        leadId,
        adminId,
        title: 'Оформить лида',
        description: 'Заполнить основную информацию о лиде',
        taskType: TaskType.REGISTER_LEAD,
        status: TaskStatus.PENDING,
        dueDate,
        taskData: {},
      },
      {
        leadId,
        adminId,
        title: 'Узнать желаемую выборку по машинам',
        description: 'Выяснить предпочтения клиента по марке, модели, году выпуска, пробегу',
        taskType: TaskType.CAR_PREFERENCES,
        status: TaskStatus.PENDING,
        dueDate,
        taskData: {
          preferredBrands: [],
          preferredModels: [],
          preferredYearFrom: null,
          preferredYearTo: null,
          preferredMileageMax: null,
        },
      },
      {
        leadId,
        adminId,
        title: 'Узнать регион',
        description: 'Выяснить регион и город клиента',
        taskType: TaskType.REGION,
        status: TaskStatus.PENDING,
        dueDate,
        taskData: {
          region: null,
          city: null,
        },
      },
      {
        leadId,
        adminId,
        title: 'Узнать бюджет',
        description: 'Выяснить бюджет клиента на покупку автомобиля',
        taskType: TaskType.BUDGET,
        status: TaskStatus.PENDING,
        dueDate,
        taskData: {
          budgetMin: null,
          budgetMax: null,
          currency: 'RUB',
        },
      },
    ];

    // Создаем задачи последовательно
    for (const taskData of defaultTasks) {
      await this.createTask(taskData);
    }
  }

  async createTask(data: {
    leadId: number;
    adminId: number;
    title: string;
    description?: string;
    taskType?: TaskType;
    status?: TaskStatus;
    dueDate?: Date;
    taskData?: any;
  }): Promise<LeadTaskEntity> {
    const task = this.leadTaskRepository.create({
      ...data,
      taskType: data.taskType || TaskType.ADDITIONAL_INFO,
      status: data.status || TaskStatus.PENDING,
    });
    const savedTask = await this.leadTaskRepository.save(task);

    // Создаем активность
    await this.createActivity({
      leadId: data.leadId,
      adminId: data.adminId,
      activityType: ActivityType.TASK_CREATED,
      description: `Создана задача: ${data.title}`,
    });

    return savedTask;
  }

  async getLeadTasks(leadId: number): Promise<LeadTaskEntity[]> {
    return await this.leadTaskRepository.find({
      where: { leadId },
      relations: ['admin'],
      order: { dueDate: 'ASC', createdAt: 'DESC' },
    });
  }

  async updateTask(
    taskId: number,
    data: {
      title?: string;
      description?: string;
      taskType?: TaskType;
      status?: TaskStatus;
      dueDate?: Date;
      completed?: boolean;
      taskData?: any;
    },
    adminId?: number,
  ): Promise<LeadTaskEntity> {
    const task = await this.leadTaskRepository.findOne({
      where: { id: taskId },
      relations: ['lead'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    if (data.completed !== undefined && data.completed && !task.completed) {
      task.completedAt = new Date();
      task.status = TaskStatus.COMPLETED;
      if (adminId) {
        await this.createActivity({
          leadId: task.leadId,
          adminId,
          activityType: ActivityType.TASK_COMPLETED,
          description: `Задача выполнена: ${task.title}`,
        });
      }
    } else if (data.status === TaskStatus.IN_PROGRESS && task.status === TaskStatus.PENDING) {
      if (adminId) {
        await this.createActivity({
          leadId: task.leadId,
          adminId,
          activityType: ActivityType.UPDATED,
          description: `Задача начата: ${task.title}`,
        });
      }
    }

    Object.assign(task, data);
    return await this.leadTaskRepository.save(task);
  }

  // Получить все задачи админа
  async getAdminTasks(adminId: number, filters?: {
    status?: TaskStatus;
    completed?: boolean;
    leadId?: number;
  }): Promise<LeadTaskEntity[]> {
    const queryBuilder = this.leadTaskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.lead', 'lead')
      .leftJoinAndSelect('task.admin', 'admin')
      .where('task.adminId = :adminId', { adminId })
      .orderBy('task.dueDate', 'ASC')
      .addOrderBy('task.createdAt', 'DESC');

    if (filters?.status) {
      queryBuilder.andWhere('task.status = :status', { status: filters.status });
    }

    if (filters?.completed !== undefined) {
      queryBuilder.andWhere('task.completed = :completed', { completed: filters.completed });
    }

    if (filters?.leadId) {
      queryBuilder.andWhere('task.leadId = :leadId', { leadId: filters.leadId });
    }

    return await queryBuilder.getMany();
  }

  async deleteTask(taskId: number): Promise<void> {
    const task = await this.leadTaskRepository.findOne({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    await this.leadTaskRepository.remove(task);
  }

  // ==================== TAGS ====================

  async createTag(name: string, color?: string): Promise<LeadTagEntity> {
    const existingTag = await this.leadTagRepository.findOne({
      where: { name },
    });

    if (existingTag) {
      return existingTag;
    }

    const tag = this.leadTagRepository.create({
      name,
      color: color || '#4f8cff',
    });

    return await this.leadTagRepository.save(tag);
  }

  async getAllTags(): Promise<LeadTagEntity[]> {
    return await this.leadTagRepository.find({
      order: { name: 'ASC' },
    });
  }

  async addTagToLead(leadId: number, tagId: number, adminId?: number): Promise<LeadEntity> {
    const lead = await this.getLeadById(leadId);
    const tag = await this.leadTagRepository.findOne({ where: { id: tagId } });

    if (!tag) {
      throw new NotFoundException(`Tag with ID ${tagId} not found`);
    }

    if (!lead.tags) {
      lead.tags = [];
    }

    if (!lead.tags.find((t) => t.id === tagId)) {
      lead.tags.push(tag);
      await this.leadRepository.save(lead);

      if (adminId) {
        await this.createActivity({
          leadId,
          adminId,
          activityType: ActivityType.TAG_ADDED,
          description: `Добавлен тег: ${tag.name}`,
        });
      }
    }

    return lead;
  }

  async removeTagFromLead(leadId: number, tagId: number, adminId?: number): Promise<LeadEntity> {
    const lead = await this.getLeadById(leadId);

    if (lead.tags) {
      lead.tags = lead.tags.filter((t) => t.id !== tagId);
      await this.leadRepository.save(lead);

      const tag = await this.leadTagRepository.findOne({ where: { id: tagId } });
      if (adminId && tag) {
        await this.createActivity({
          leadId,
          adminId,
          activityType: ActivityType.TAG_REMOVED,
          description: `Удален тег: ${tag.name}`,
        });
      }
    }

    return lead;
  }

  // ==================== ATTACHMENTS ====================

  async createAttachment(data: {
    leadId: number;
    adminId?: number;
    fileName: string;
    filePath: string;
    fileSize?: number;
    mimeType?: string;
    description?: string;
  }): Promise<LeadAttachmentEntity> {
    const attachment = this.leadAttachmentRepository.create(data);
    const savedAttachment = await this.leadAttachmentRepository.save(attachment);

    if (data.adminId) {
      await this.createActivity({
        leadId: data.leadId,
        adminId: data.adminId,
        activityType: ActivityType.FILE_ATTACHED,
        description: `Прикреплен файл: ${data.fileName}`,
      });
    }

    return savedAttachment;
  }

  async getLeadAttachments(leadId: number): Promise<LeadAttachmentEntity[]> {
    return await this.leadAttachmentRepository.find({
      where: { leadId },
      relations: ['admin'],
      order: { createdAt: 'DESC' },
    });
  }

  async deleteAttachment(attachmentId: number): Promise<void> {
    const attachment = await this.leadAttachmentRepository.findOne({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment with ID ${attachmentId} not found`);
    }

    await this.leadAttachmentRepository.remove(attachment);
  }

  // ==================== MEETINGS ====================

  async createMeeting(data: {
    leadId: number;
    adminId: number;
    title: string;
    description?: string;
    meetingDate: Date;
    location?: string;
    meetingType?: MeetingType;
  }): Promise<LeadMeetingEntity> {
    const meeting = this.leadMeetingRepository.create(data);
    const savedMeeting = await this.leadMeetingRepository.save(meeting);

    await this.createActivity({
      leadId: data.leadId,
      adminId: data.adminId,
      activityType: ActivityType.MEETING_SCHEDULED,
      description: `Запланирована встреча: ${data.title}`,
    });

    // Обновляем nextFollowUpDate у лида
    const lead = await this.getLeadById(data.leadId);
    if (!lead.nextFollowUpDate || lead.nextFollowUpDate > data.meetingDate) {
      lead.nextFollowUpDate = data.meetingDate;
      await this.leadRepository.save(lead);
    }

    return savedMeeting;
  }

  async getLeadMeetings(leadId: number): Promise<LeadMeetingEntity[]> {
    return await this.leadMeetingRepository.find({
      where: { leadId },
      relations: ['admin'],
      order: { meetingDate: 'ASC' },
    });
  }

  async updateMeeting(
    meetingId: number,
    data: {
      title?: string;
      description?: string;
      meetingDate?: Date;
      location?: string;
      meetingType?: MeetingType;
      completed?: boolean;
    },
  ): Promise<LeadMeetingEntity> {
    const meeting = await this.leadMeetingRepository.findOne({
      where: { id: meetingId },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    Object.assign(meeting, data);
    return await this.leadMeetingRepository.save(meeting);
  }

  async deleteMeeting(meetingId: number): Promise<void> {
    const meeting = await this.leadMeetingRepository.findOne({
      where: { id: meetingId },
    });

    if (!meeting) {
      throw new NotFoundException(`Meeting with ID ${meetingId} not found`);
    }

    await this.leadMeetingRepository.remove(meeting);
  }

  // ==================== LEAD SCORING ====================

  async calculateLeadScore(leadId: number): Promise<number> {
    const lead = await this.getLeadById(leadId);
    let score = 0;

    // Базовая оценка по источнику
    const sourceScores: Record<LeadSource, number> = {
      [LeadSource.CHAT]: 10,
      [LeadSource.TELEGRAM]: 15,
      [LeadSource.PHONE]: 20,
      [LeadSource.EMAIL]: 15,
      [LeadSource.OTHER]: 5,
    };
    score += sourceScores[lead.source] || 0;

    // Наличие контактов
    if (lead.email) score += 10;
    if (lead.phone) score += 15;
    if (lead.hasTelegramContact) score += 5;

    // Приоритет
    const priorityScores: Record<LeadPriority, number> = {
      [LeadPriority.LOW]: 5,
      [LeadPriority.NORMAL]: 10,
      [LeadPriority.HIGH]: 20,
      [LeadPriority.URGENT]: 30,
    };
    score += priorityScores[lead.priority] || 0;

    // Назначен админ
    if (lead.assignedAdminId) score += 10;

    // Есть комментарии
    if (lead.comments && lead.comments.length > 0) score += 5;

    // Есть задачи
    if (lead.tasks && lead.tasks.length > 0) score += 10;

    // Есть встречи
    if (lead.meetings && lead.meetings.length > 0) score += 15;

    // Максимальный score 100
    score = Math.min(score, 100);

    lead.score = score;
    await this.leadRepository.save(lead);

    return score;
  }

  async convertLeadToClient(leadId: number, adminId?: number): Promise<LeadEntity> {
    const lead = await this.getLeadById(leadId);

    lead.convertedToClient = true;
    lead.convertedAt = new Date();
    lead.status = LeadStatus.CLOSED;

    const updatedLead = await this.leadRepository.save(lead);

    if (adminId) {
      await this.createActivity({
        leadId,
        adminId,
        activityType: ActivityType.CONVERTED,
        description: 'Лид конвертирован в клиента',
      });
    }

    return updatedLead;
  }
}

