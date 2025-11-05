import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { LeadEntity, LeadCommentEntity, LeadSource, LeadStatus, LeadPriority } from './lead.entity';
import { AdminEntity } from '../../db/admin.entity';
import { ChatSessionEntity } from '../chat/chat.entity';
import { LeadActivityEntity, ActivityType } from './lead-activity.entity';
import { LeadTaskEntity } from './lead-task.entity';
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
  async createLead(createLeadDto: CreateLeadDto, adminId?: number): Promise<LeadEntity> {
    const lead = this.leadRepository.create(createLeadDto);
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
    });

    return await this.leadRepository.save(lead);
  }

  // Получить все лиды
  async getAllLeads(
    filters?: {
      status?: LeadStatus;
      source?: LeadSource;
      assignedAdminId?: number;
      search?: string;
    },
  ): Promise<LeadEntity[]> {
    const queryBuilder = this.leadRepository
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.assignedAdmin', 'admin')
      .leftJoinAndSelect('lead.comments', 'comments')
      .leftJoinAndSelect('comments.admin', 'commentAdmin')
      .orderBy('lead.createdAt', 'DESC');

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
  ): Promise<LeadEntity> {
    const lead = await this.getLeadById(id);
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
  async deleteLead(id: number): Promise<void> {
    const lead = await this.getLeadById(id);
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

  async createTask(data: {
    leadId: number;
    adminId: number;
    title: string;
    description?: string;
    dueDate?: Date;
  }): Promise<LeadTaskEntity> {
    const task = this.leadTaskRepository.create(data);
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
      dueDate?: Date;
      completed?: boolean;
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
      if (adminId) {
        await this.createActivity({
          leadId: task.leadId,
          adminId,
          activityType: ActivityType.TASK_COMPLETED,
          description: `Задача выполнена: ${task.title}`,
        });
      }
    }

    Object.assign(task, data);
    return await this.leadTaskRepository.save(task);
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

