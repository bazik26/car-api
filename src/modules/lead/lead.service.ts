import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadEntity, LeadCommentEntity, LeadSource, LeadStatus, LeadPriority } from './lead.entity';
import { AdminEntity } from '../../db/admin.entity';
import { ChatSessionEntity } from '../chat/chat.entity';

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
  ) {}

  // Создать лид
  async createLead(createLeadDto: CreateLeadDto): Promise<LeadEntity> {
    const lead = this.leadRepository.create(createLeadDto);
    return await this.leadRepository.save(lead);
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
      relations: ['assignedAdmin', 'comments', 'comments.admin'],
      order: { comments: { createdAt: 'ASC' } },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${id} not found`);
    }

    return lead;
  }

  // Обновить лид
  async updateLead(id: number, updateLeadDto: UpdateLeadDto): Promise<LeadEntity> {
    const lead = await this.getLeadById(id);

    Object.assign(lead, updateLeadDto);

    return await this.leadRepository.save(lead);
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
}

