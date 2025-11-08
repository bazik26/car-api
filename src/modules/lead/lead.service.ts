import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { LeadEntity, LeadCommentEntity, LeadSource, LeadStatus, LeadPriority, PipelineStage } from './lead.entity';
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
  pipelineStage?: PipelineStage;
  hasTelegramContact?: boolean;
  telegramUsername?: string;
  assignedAdminId?: number;
  description?: string;
  projectId?: ProjectType;
  budget?: { min: number; max: number; currency: string };
  carPreferences?: any;
  city?: string;
  region?: string;
  timeline?: string;
  objections?: string;
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
    const projectSource = createLeadDto.projectSource || (admin?.projectId === ProjectType.OFFICE_1 ? 'office_1' : admin?.projectId === ProjectType.OFFICE_2 ? 'office_2' : 'manual');
    
    // АВТОМАТИЧЕСКОЕ НАЗНАЧЕНИЕ АДМИНА (если не указан)
    let assignedAdminId = createLeadDto.assignedAdminId;
    if (!assignedAdminId) {
      assignedAdminId = await this.autoAssignAdmin(projectId);
    }
    
    const lead = this.leadRepository.create({
      ...createLeadDto,
      projectId,
      projectSource,
      assignedAdminId,
      pipelineStage: PipelineStage.NEW_LEAD,
      nextFollowUpDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // Через 2 часа
    });
    const savedLead = await this.leadRepository.save(lead);

    // Создаем активность
    const activityAdminId = adminId || assignedAdminId;
    if (activityAdminId) {
      await this.createActivity({
        leadId: savedLead.id,
        adminId: activityAdminId,
        activityType: ActivityType.CREATED,
        description: 'Лид создан и автоматически назначен на менеджера',
      });
    }

    // Автоматически создаем задачи для обработки лида
    await this.createDefaultTasksForLead(savedLead.id, assignedAdminId);

    // Рассчитываем score
    await this.calculateLeadScore(savedLead.id);

    return savedLead;
  }
  
  // Автоматическое назначение админа на лид (Round Robin + Load Balancing)
  private async autoAssignAdmin(projectId: ProjectType): Promise<number | undefined> {
    // Получаем всех админов с правами на управление лидами
    const admins = await this.adminRepository.find({
      where: { projectId },
    });
    
    // Фильтруем только тех, у кого есть права canManageLeads
    const availableAdmins = admins.filter(admin => 
      admin.permissions?.canManageLeads !== false
    );
    
    if (availableAdmins.length === 0) {
      return undefined;
    }
    
    // Подсчитываем активные лиды для каждого админа (Load Balancing)
    const adminLoads = await Promise.all(
      availableAdmins.map(async (admin) => {
        const activeLeadsCount = await this.leadRepository.count({
          where: {
            assignedAdminId: admin.id,
            status: In([LeadStatus.NEW, LeadStatus.IN_PROGRESS, LeadStatus.CONTACTED]),
          },
        });
        return { admin, activeLeadsCount };
      })
    );
    
    // Сортируем по загруженности (меньше лидов = выше приоритет)
    adminLoads.sort((a, b) => a.activeLeadsCount - b.activeLeadsCount);
    
    // Назначаем на админа с наименьшей загрузкой
    return adminLoads[0].admin.id;
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

  // Получить все лиды (УЛУЧШЕНО: поддержка Lead Manager)
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

    // СУПЕР-АДМИН И LEAD MANAGER видят ВСЕХ лидов
    const isLeadManager = admin?.permissions?.isLeadManager || false;
    
    // Для обычных админов (не супер и не Lead Manager) фильтруем по projectId
    if (admin && !admin.isSuper && !isLeadManager) {
      // Используем projectId админа или дефолтное значение
      const adminProjectId = admin.projectId || ProjectType.OFFICE_1;
      queryBuilder.andWhere('lead.projectId = :projectId', { projectId: adminProjectId });
    }
    // Если супер-админ или Lead Manager - показываем всех лидов из всех офисов

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
    if (admin && !admin.isSuper) {
      // Используем projectId админа или дефолтное значение
      const adminProjectId = admin.projectId || ProjectType.OFFICE_1;
      queryBuilder.andWhere('lead.projectId = :projectId', { projectId: adminProjectId });
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

  // Автоматически создаем задачи для обработки нового лида (УЛУЧШЕННАЯ ВЕРСИЯ)
  async createDefaultTasksForLead(leadId: number, adminId?: number): Promise<void> {
    if (!adminId) {
      // Если админ не назначен, не создаем задачи
      return;
    }

    const lead = await this.getLeadById(leadId);
    if (!lead) {
      return;
    }

    // Список задач с подробными скриптами (в правильной последовательности)
    const defaultTasks = [
      // ===== ЭТАП 1: Первый контакт (0-2 часа) =====
      {
        leadId,
        adminId,
        title: '1️⃣ Первый звонок клиенту',
        description: `
🎯 ЦЕЛЬ: Установить контакт и узнать удобное время для разговора

📞 СКРИПТ ЗВОНКА:
━━━━━━━━━━━━━━━━
ПРИВЕТСТВИЕ:
"Здравствуйте, ${lead.name}! Меня зовут [ВАШЕ ИМЯ], компания Auto Broker - пригон автомобилей из Европы.
Вы оставляли заявку на пригон автомобиля. Удобно ли вам сейчас говорить?"

ЕСЛИ ДА:
✅ "Отлично! Расскажите, какой автомобиль вас интересует?"
→ Переходим к задаче 3 "Выявление потребностей"

ЕСЛИ НЕТ:
⏰ "Понимаю. Когда вам будет удобно? Могу перезвонить в..."
→ Записать время в комментарий
→ Создать напоминание

📝 ЧТО ОТМЕТИТЬ:
- ✓ Дата/время звонка: _______
- ✓ Клиент взял трубку: Да/Нет
- ✓ Удобное время для разговора: _______
- ✓ Результат: _______

⚡ ДЕДЛАЙН: 2 часа с момента создания лида
        `,
        taskType: TaskType.FIRST_CONTACT,
        status: TaskStatus.PENDING,
        dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // Через 2 часа
        taskData: {
          step: 1,
          contactMethod: null,
          contactResult: null,
          nextCallTime: null,
        },
      },
      
      // ===== ЭТАП 2: Квалификация (2-24 часа) =====
      {
        leadId,
        adminId,
        title: '2️⃣ Квалификация - собрать контактные данные',
        description: `
🎯 ЦЕЛЬ: Собрать полную информацию о клиенте

📋 ЧТО УЗНАТЬ (обязательно):
━━━━━━━━━━━━━━━━━━━━━━━━━━
- ✓ Полное имя: ${lead.name || '_______'}
- ✓ Email: ${lead.email || '_______'}
- ✓ Телефон: ${lead.phone || '_______'}
- ✓ Telegram: ${lead.telegramUsername || '_______'}
- ✓ Город доставки: _______
- ✓ Когда планирует покупку: _______

💬 СКРИПТ:
"Давайте я запишу ваши контакты, чтобы держать вас в курсе:
- На какой email вам отправить предложения?
- Телефон для связи?
- Пользуетесь ли Telegram? (удобнее отправлять фото)"

⚡ ДЕДЛАЙН: 24 часа
        `,
        taskType: TaskType.QUALIFICATION,
        status: TaskStatus.PENDING,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        taskData: {
          step: 2,
        },
      },
      
      // ===== ЭТАП 3: Выявление потребностей (1-3 дня) =====
      {
        leadId,
        adminId,
        title: '3️⃣ Узнать предпочтения по автомобилям',
        description: `
🎯 ЦЕЛЬ: Понять какой именно автомобиль нужен клиенту

💬 СКРИПТ БЕСЕДЫ:
━━━━━━━━━━━━━━━━
"Давайте подберем идеальный автомобиль для вас:

1️⃣ МАРКА/МОДЕЛЬ:
"Какие марки вам нравятся?" → BMW, Mercedes, Audi, Volkswagen...
"Какую модель рассматриваете?" → X5, E-Class, Q7...
"Почему именно эта модель?" → _______

2️⃣ ГОД ВЫПУСКА:
"Интересует новый автомобиль или с пробегом?"
"Какой год выпуска?" → от_____ до_____

3️⃣ ПРОБЕГ:
"Максимальный пробег который рассматриваете?" → до_____ км

4️⃣ КОМПЛЕКТАЦИЯ:
"Что важно в комплектации?"
- Коробка передач: автомат/механика
- Тип топлива: бензин/дизель/гибрид/электро
- Тип кузова: седан/универсал/кроссовер
- Привод: полный/передний/задний

5️⃣ СОСТОЯНИЕ:
"Готовы рассматривать авто с небольшими дефектами за меньшую цену?"

📝 ЗАПОЛНИТЬ В СИСТЕМЕ:
- Марки: _______
- Модели: _______
- Год: от_____ до_____
- Пробег: до_____ км
- Тип кузова: _______
- Коробка: _______
- Топливо: _______

⚡ ДЕДЛАЙН: 3 дня
        `,
        taskType: TaskType.CAR_PREFERENCES,
        status: TaskStatus.PENDING,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        taskData: {
          step: 3,
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
        title: '4️⃣ Узнать бюджет клиента',
        description: `
🎯 ЦЕЛЬ: Понять финансовые возможности клиента

💬 СКРИПТ:
━━━━━━━━━━━━━━━━
"Какой бюджет вы планируете на покупку автомобиля?"

ВАЖНО спросить:
"Это бюджет только на авто или на всё 'под ключ'?"
(включая доставку, растаможку, оформление)

📊 ВАРИАНТЫ ОТВЕТА:
1. Называет конкретную сумму: _______₽
2. Называет диапазон: от_____ до_____₽
3. Не определился: "Зависит от варианта"
   → Уточнить примерную вилку

💡 СОВЕТ:
Если бюджет ниже реальной стоимости:
"Понимаю. Давайте я покажу, из чего складывается стоимость 'под ключ'.
Возможно, подберем варианты с меньшим пробегом или более простой комплектацией."

📝 ЗАПИСАТЬ В СИСТЕМУ:
- Бюджет от: _____ ₽
- Бюджет до: _____ ₽
- Включает ли доставку: Да/Нет
- Готов ли платить больше за лучшее состояние: Да/Нет

⚡ ДЕДЛАЙН: 3 дня
        `,
        taskType: TaskType.BUDGET,
        status: TaskStatus.PENDING,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        taskData: {
          step: 4,
          budgetMin: null,
          budgetMax: null,
          currency: 'RUB',
        },
      },
      
      {
        leadId,
        adminId,
        title: '5️⃣ Узнать регион и город доставки',
        description: `
🎯 ЦЕЛЬ: Понять куда доставлять автомобиль

💬 СКРИПТ:
━━━━━━━━━━━━━━━━
"Куда вам нужно доставить автомобиль?"

- Регион: _______
- Город: _______

ДОПОЛНИТЕЛЬНО:
"Нужна ли помощь с регистрацией в ГИБДД?" → Да/Нет
"Есть ли у вас опыт покупки авто из Европы?" → Да/Нет

💡 ВАЖНО:
Регион влияет на:
- Стоимость доставки
- Сроки доставки  
- Стоимость растаможки

📝 ЗАПИСАТЬ:
- Регион: _______
- Город: _______
- Нужна регистрация: Да/Нет
- Опыт покупки: Да/Нет

⚡ ДЕДЛАЙН: 3 дня
        `,
        taskType: TaskType.REGION,
        status: TaskStatus.PENDING,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        taskData: {
          step: 5,
          region: null,
          city: null,
        },
      },
      
      {
        leadId,
        adminId,
        title: '6️⃣ Узнать сроки покупки',
        description: `
🎯 ЦЕЛЬ: Понять срочность сделки и приоритизировать

💬 СКРИПТ:
━━━━━━━━━━━━━━━━
"Когда вы планируете приобрести автомобиль?"

ВАРИАНТЫ ОТВЕТА:
- "Как можно скорее" → 🔥 СРОЧНО! Приоритет высокий
- "В течение месяца" → Стандартный срок
- "Через 2-3 месяца" → Низкий приоритет
- "Просто смотрю варианты" → Очень низкий

УТОЧНИТЬ:
"Что может повлиять на сроки? Есть ли привязка к датам?"
(продажа старого авто, отпуск, др)

📝 ЗАПИСАТЬ:
- Сроки: _______
- Причина срочности: _______
- Приоритет: Высокий/Средний/Низкий

⚡ ДЕЙСТВИЯ:
Если срочно → изменить приоритет лида на HIGH/URGENT
Если не срочно → стандартная обработка

⚡ ДЕДЛАЙН: 3 дня
        `,
        taskType: TaskType.TIMELINE,
        status: TaskStatus.PENDING,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        taskData: {
          step: 6,
          timeline: null,
          urgency: 'medium',
        },
      },
      
      // ===== ЭТАП 4: Презентация (3-7 дней) =====
      {
        leadId,
        adminId,
        title: '7️⃣ Отправить подборку автомобилей',
        description: `
🎯 ЦЕЛЬ: Показать клиенту 3-5 подходящих вариантов

📋 ЧЕК-ЛИСТ:
━━━━━━━━━━━━━━━━
- ✓ Подобрать 3-5 вариантов из базы (соответствуют критериям)
- ✓ Сделать подробные фотоотчеты
- ✓ Рассчитать стоимость "под ключ" для каждого
- ✓ Отправить на Email/Telegram
- ✓ Дождаться обратной связи (48 часов)

📧 ШАБЛОН СООБЩЕНИЯ:
━━━━━━━━━━━━━━━━
"${lead.name}, добрый день!

Подобрал для вас несколько отличных вариантов:

1. [Марка] [Модель] [Год]
   - Пробег: [X] км
   - Комплектация: [описание]
   - Цена авто в Европе: [Y] €
   - Стоимость 'под ключ': [Z] ₽
   [Ссылка на фото]

2. [Второй вариант...]

3. [Третий вариант...]

Какой вариант больше нравится? 
Могу прислать больше фото, видео или подобрать другие варианты.

С уважением,
[ВАШЕ ИМЯ]
Auto Broker"

⚡ ДЕДЛАЙН: 7 дней
        `,
        taskType: TaskType.SEND_OFFERS,
        status: TaskStatus.PENDING,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        taskData: {
          step: 7,
          offersSent: [],
        },
      },
      
      {
        leadId,
        adminId,
        title: '8️⃣ Отправить детальный расчет стоимости',
        description: `
🎯 ЦЕЛЬ: Показать прозрачность ценообразования

💰 ШАБЛОН РАСЧЕТА "ПОД КЛЮЧ":
━━━━━━━━━━━━━━━━━━━━━━━━━━
Автомобиль: [Марка] [Модель] [Год]

СТОИМОСТЬ:
┌─────────────────────────┬──────────┐
│ Стоимость в Европе      │ [X] €    │
│ Доставка до России      │ [Y] €    │
│ Растаможка              │ [Z] €    │
│ Оформление документов   │ [W] €    │
│ Регистрация в ГИБДД     │ [V] ₽    │
├─────────────────────────┼──────────┤
│ ИТОГО "ПОД КЛЮЧ":       │ [T] ₽    │
└─────────────────────────┴──────────┘

✅ ЧТО ВХОДИТ В СТОИМОСТЬ:
• Покупка авто на аукционе/у дилера
• Проверка авто перед покупкой
• Доставка до России (транспортировка)
• Растаможка (все таможенные платежи)
• Оформление всех документов
• Регистрация в ГИБДД вашего региона
• Гарантия юридической чистоты
• Сопровождение сделки от А до Я

💡 ПРЕИМУЩЕСТВА:
"Вы получаете автомобиль с европейским качеством обслуживания,
полностью готовый к эксплуатации, с гарантией."

⚡ ДЕДЛАЙН: 7 дней
        `,
        taskType: TaskType.SEND_CALCULATION,
        status: TaskStatus.PENDING,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        taskData: {
          step: 8,
        },
      },
      
      // ===== ЭТАП 5: Работа с возражениями (7-14 дней) =====
      {
        leadId,
        adminId,
        title: '9️⃣ Повторная связь / Follow-up',
        description: `
🎯 ЦЕЛЬ: Узнать реакцию на подборку и продвинуть сделку

💬 СЦЕНАРИИ:
━━━━━━━━━━━━━━━━

📞 Клиент не ответил на подборку (прошло 2-3 дня):
"${lead.name}, добрый день!
Отправлял вам подборку автомобилей. Успели посмотреть?
Может возникли вопросы? С удовольствием отвечу."

💭 Клиент думает:
"Понимаю, что нужно время на раздумья.
Могу подобрать дополнительные варианты или показать видео-обзор авто.
Когда вам позвонить для обсуждения?"

⏰ Клиент просил перезвонить:
Перезвонить строго в указанное время!

📝 ЧТО ВЫЯСНИТЬ:
- Понравились ли варианты?
- Что смущает/не подходит?
- Какие есть вопросы?
- Готов ли рассмотреть покупку?

⚡ ДЕДЛАЙН: 14 дней
        `,
        taskType: TaskType.FOLLOW_UP,
        status: TaskStatus.PENDING,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        taskData: {
          step: 9,
          followUpReason: null,
        },
      },
      
      {
        leadId,
        adminId,
        title: '🔟 Обработать возражения клиента',
        description: `
🎯 ЦЕЛЬ: Снять возражения и продвинуть к сделке

❌ ТИПИЧНЫЕ ВОЗРАЖЕНИЯ И ОТВЕТЫ:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ "ДОРОГО"
✅ "Понимаю ваше беспокойство. Давайте разберем, из чего складывается цена:
- Цена авто в Европе обычно на 15-20% ниже чем в РФ
- Растаможка - фиксированная ставка
- Доставка - около [X]₽
В итоге экономия 10-15% vs покупки в РФ + вы выбираете конкретный экземпляр."

Альтернатива: "Могу подобрать варианты дешевле или с большим пробегом."

2️⃣ "ДОЛГО ЖДАТЬ"
✅ "Полный цикл 3-4 недели. НО!
У нас есть авто 'в пути' - получите через 7-10 дней.
Также можем искать варианты ближе к границе - доставка 1-2 недели.
Показать такие варианты?"

3️⃣ "НЕ УВЕРЕН В НАДЕЖНОСТИ"
✅ "Отличный вопрос! Мы гарантируем:
- Полная проверка авто перед покупкой (диагностика, история)
- Юридическое сопровождение всей сделки
- Договор с четкими обязательствами
- 500+ довольных клиентов за 15 лет
- Можем показать отзывы реальных клиентов"

4️⃣ "НАЙДУ САМ ДЕШЕВЛЕ"
✅ "Конечно, можете поискать сами. Но учтите:
- Риски покупки 'кота в мешке'
- Языковой барьер
- Знание всех нюансов растаможки
- Время на организацию
Мы экономим ваше время и нервы. Стоимость наших услуг - [X]₽.
Это меньше чем потери от ошибок при самостоятельной покупке."

5️⃣ "ХОЧУ ПОДУМАТЬ"
✅ "Конечно, решение серьезное. Подумайте.
Могу ли чем-то помочь в принятии решения?
Может какие-то вопросы или сомнения?"
→ Назначить следующий звонок через 3-5 дней

📝 ЗАПИСАТЬ:
- Основное возражение: _______
- Как ответили: _______
- Результат: _______

⚡ ДЕДЛАЙН: 14 дней
        `,
        taskType: TaskType.OBJECTION_HANDLING,
        status: TaskStatus.PENDING,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        taskData: {
          step: 10,
          objections: [],
        },
      },
      
      // ===== ЭТАП 6: Закрытие сделки (14-30 дней) =====
      {
        leadId,
        adminId,
        title: '1️⃣1️⃣ Назначить встречу/созвон',
        description: `
🎯 ЦЕЛЬ: Детально обсудить выбранный вариант

📞 ТИПЫ ВСТРЕЧ:
━━━━━━━━━━━━━━━━
1. Звонок (30-60 мин) - детальное обсуждение
2. Видеосвязь - показ авто в реальном времени
3. Встреча в офисе - личное общение
4. Выезд на просмотр авто (если в России)

💬 СКРИПТ:
"${lead.name}, давайте назначим удобное время для детального обсуждения.
Когда вам удобно? Могу:
- Созвониться (WhatsApp/Telegram/обычный звонок)
- Видеосвязь (покажу авто в прямом эфире)
- Встретиться в офисе (адрес: Ярославль)"

📅 ПОДГОТОВКА К ВСТРЕЧЕ:
- Подготовить презентацию авто
- Распечатать расчеты
- Подготовить договор (черновик)
- Подготовить ответы на вопросы

📝 ЗАПИСАТЬ:
- Дата/время: _______
- Тип встречи: _______
- Место (если офис): _______
- Что обсуждать: _______

⚡ ДЕДЛАЙН: 14 дней
        `,
        taskType: TaskType.SCHEDULE_MEETING,
        status: TaskStatus.PENDING,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        taskData: {
          step: 11,
        },
      },
      
      {
        leadId,
        adminId,
        title: '1️⃣2️⃣ Отправить договор на согласование',
        description: `
🎯 ЦЕЛЬ: Подготовить и отправить договор клиенту

📋 ЧЕК-ЛИСТ ПОДГОТОВКИ ДОГОВОРА:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
- ✓ Указать данные клиента (ФИО, паспорт, адрес)
- ✓ Указать автомобиль (марка, модель, VIN, год)
- ✓ Указать стоимость "под ключ"
- ✓ Прописать условия оплаты (предоплата 30-50%)
- ✓ Указать сроки поставки
- ✓ Прописать гарантии
- ✓ Указать ответственность сторон

💬 СКРИПТ ОТПРАВКИ:
"${lead.name}, высылаю вам договор на пригон автомобиля.

Основные условия:
- Автомобиль: [Марка] [Модель] [Год]
- Стоимость 'под ключ': [X] ₽
- Предоплата: [Y] ₽ (30%)
- Срок поставки: 3-4 недели

Пожалуйста, ознакомьтесь с условиями.
Если всё устраивает - пришлите подписанный скан.
Если есть вопросы/правки - созвонимся и обсудим."

📝 ЗАПИСАТЬ:
- Договор отправлен: дата/время
- Согласован: Да/Нет/Правки
- Комментарии клиента: _______

⚡ ДЕДЛАЙН: 21 день
        `,
        taskType: TaskType.SEND_CONTRACT,
        status: TaskStatus.PENDING,
        dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        taskData: {
          step: 12,
        },
      },
      
      {
        leadId,
        adminId,
        title: '1️⃣3️⃣ Получить предоплату',
        description: `
🎯 ЦЕЛЬ: Получить предоплату для запуска процесса пригона

💰 УСЛОВИЯ ОПЛАТЫ:
━━━━━━━━━━━━━━━━
Стандарт: 30-50% предоплата
Остаток: после доставки в Россию или по приезду к клиенту

💬 СКРИПТ:
"${lead.name}, для запуска процесса пригона нужна предоплата.

Сумма предоплаты: [X] ₽ (30% от стоимости)

Варианты оплаты:
- Перевод на карту
- Банковский перевод
- Наличные в офисе

После получения предоплаты:
✓ Запускаем поиск/покупку авто (2-3 дня)
✓ Организуем доставку
✓ Держим вас в курсе на каждом этапе

Удобен ли вам такой вариант?"

📝 ЧТО ДЕЛАТЬ:
1. Выслать реквизиты для оплаты
2. Отследить поступление платежа
3. Подтвердить получение
4. Запустить процесс пригона

⚠️ ВАЖНО:
После получения предоплаты - сразу уведомить клиента!
Отправить чек/подтверждение.

📝 ЗАПИСАТЬ:
- Предоплата: [X] ₽
- Дата получения: _______
- Способ оплаты: _______
- Запущен пригон: Да/Нет

⚡ ДЕДЛАЙН: 30 дней
        `,
        taskType: TaskType.GET_PREPAYMENT,
        status: TaskStatus.PENDING,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        taskData: {
          step: 13,
          prepaymentAmount: null,
          prepaymentReceived: false,
        },
      },
      
      {
        leadId,
        adminId,
        title: '1️⃣4️⃣ Подтверждение сделки',
        description: `
🎯 ЦЕЛЬ: Финализировать сделку и запустить пригон

🎉 ФИНАЛЬНЫЕ ШАГИ:
━━━━━━━━━━━━━━━━
1. ✓ Договор подписан обеими сторонами
2. ✓ Предоплата получена
3. ✓ Автомобиль выбран и подтвержден
4. ✓ Запущен процесс покупки

💬 СКРИПТ ПОДТВЕРЖДЕНИЯ:
"${lead.name}, поздравляю!

Все документы подписаны, предоплата получена.
Запускаем пригон вашего [Марка] [Модель]!

ПЛАН ДЕЙСТВИЙ:
📅 День 1-3: Покупка авто в Европе
📅 День 4-7: Подготовка к отправке
📅 День 8-21: Доставка до России
📅 День 22-28: Растаможка
📅 День 29-30: Оформление и передача вам

Буду держать вас в курсе каждые 3-5 дней.
Трек-номер отправки пришлю как только авто будет в пути.

Остались вопросы?"

📝 ДЕЙСТВИЯ:
- Отправить клиенту трек-номер (как появится)
- Отправлять фото на каждом этапе
- Уведомлять о прохождении таможни
- Согласовать время и место передачи

⚡ СЛЕДУЮЩИЙ ШАГ:
После успешной передачи авто → конвертировать в клиента (WON)

⚡ ДЕДЛАЙН: 30 дней
        `,
        taskType: TaskType.CONFIRM_DEAL,
        status: TaskStatus.PENDING,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        taskData: {
          step: 14,
          dealConfirmed: false,
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
      
      // АВТОМАТИЧЕСКИЙ ПЕРЕХОД К СЛЕДУЮЩЕМУ ЭТАПУ при выполнении ключевой задачи
      await this.autoAdvancePipelineStage(task.leadId, task.taskType);
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
  
  // Автоматический переход к следующему этапу воронки при выполнении ключевых задач
  private async autoAdvancePipelineStage(leadId: number, completedTaskType: TaskType): Promise<void> {
    const lead = await this.getLeadById(leadId);
    if (!lead) return;
    
    // Маппинг: какая задача переводит на какой этап
    const taskToStageMap: Partial<Record<TaskType, PipelineStage>> = {
      [TaskType.FIRST_CONTACT]: PipelineStage.QUALIFICATION,
      [TaskType.QUALIFICATION]: PipelineStage.NEEDS_ANALYSIS,
      [TaskType.CAR_PREFERENCES]: PipelineStage.PRESENTATION, // Когда узнали все потребности
      [TaskType.SEND_OFFERS]: PipelineStage.NEGOTIATION,
      [TaskType.SEND_CALCULATION]: PipelineStage.NEGOTIATION,
      [TaskType.SCHEDULE_MEETING]: PipelineStage.DEAL_CLOSING,
      [TaskType.SEND_CONTRACT]: PipelineStage.DEAL_CLOSING,
      [TaskType.GET_PREPAYMENT]: PipelineStage.DEAL_CLOSING,
      [TaskType.CONFIRM_DEAL]: PipelineStage.WON,
    };
    
    const nextStage = taskToStageMap[completedTaskType];
    
    // Если для этого типа задачи определен следующий этап И текущий этап ниже
    if (nextStage) {
      const currentStageIndex = this.getStageIndex(lead.pipelineStage);
      const nextStageIndex = this.getStageIndex(nextStage);
      
      // Переходим только вперед, не назад
      if (nextStageIndex > currentStageIndex) {
        lead.pipelineStage = nextStage;
        await this.leadRepository.save(lead);
      }
    }
  }
  
  private getStageIndex(stage: PipelineStage): number {
    const stages = [
      PipelineStage.NEW_LEAD,
      PipelineStage.FIRST_CONTACT,
      PipelineStage.QUALIFICATION,
      PipelineStage.NEEDS_ANALYSIS,
      PipelineStage.PRESENTATION,
      PipelineStage.NEGOTIATION,
      PipelineStage.DEAL_CLOSING,
      PipelineStage.WON,
      PipelineStage.LOST,
    ];
    return stages.indexOf(stage);
  }

  // Получить все задачи админа (УЛУЧШЕНО: поддержка супер-админа и Lead Manager)
  async getAdminTasks(adminId: number, filters?: {
    status?: TaskStatus;
    completed?: boolean;
    leadId?: number;
  }, admin?: AdminEntity): Promise<LeadTaskEntity[]> {
    const queryBuilder = this.leadTaskRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.lead', 'lead')
      .leftJoinAndSelect('task.admin', 'admin');

    // СУПЕР-АДМИН И LEAD MANAGER видят ВСЕ задачи
    const isLeadManager = admin?.permissions?.isLeadManager || false;
    if (!admin?.isSuper && !isLeadManager) {
      // Обычный админ - только свои задачи
      queryBuilder.where('task.adminId = :adminId', { adminId });
    }
    // Если супер-админ или Lead Manager - не фильтруем по adminId (видят всё)

    queryBuilder
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

