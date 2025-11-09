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
    
    const hadTasksBefore = (lead.tasks?.length || 0) > 0;
    const previousStage = lead.pipelineStage;
    const previousAssignedAdminId = lead.assignedAdminId;
    const oldValues = { ...lead };

    Object.assign(lead, updateLeadDto);

    const updatedLead = await this.leadRepository.save(lead);

    const pipelineStageChanged =
      updateLeadDto.pipelineStage &&
      updateLeadDto.pipelineStage !== previousStage;
    const assignedAdminChanged =
      updateLeadDto.assignedAdminId !== undefined &&
      updateLeadDto.assignedAdminId !== previousAssignedAdminId;

    if (!hadTasksBefore || pipelineStageChanged || assignedAdminChanged) {
      await this.createDefaultTasksForLead(
        updatedLead.id,
        updatedLead.assignedAdminId || adminId,
      );
    }

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

    // Проверяем существующие задачи, чтобы не создавать дубликаты
    const existingTasks = await this.leadTaskRepository.find({
      where: { leadId },
    });
    const existingTaskTypes = new Set(existingTasks.map((task) => task.taskType));

    // Если лид переназначен – обновляем назначение невыполненных задач
    if (existingTasks.length && adminId) {
      const tasksToReassign = existingTasks.filter(
        (task) => !task.completed && task.adminId !== adminId,
      );
      if (tasksToReassign.length) {
        for (const task of tasksToReassign) {
          task.adminId = adminId;
        }
        await this.leadTaskRepository.save(tasksToReassign);
      }
    }

    // Список из 3 основных задач (упрощенная воронка)
    const defaultTasks = [
      // ===== ЗАДАЧА 1: Первый контакт - собрать всю информацию =====
      {
        leadId,
        adminId,
        title: '1️⃣ Первый контакт - собрать всю информацию',
        description: `
🎯 ЦЕЛЬ: Установить контакт и собрать всю необходимую информацию за один раз

📞 СКРИПТ ЗВОНКА:
━━━━━━━━━━━━━━━━
ПРИВЕТСТВИЕ:
"Здравствуйте, ${lead.name || 'клиент'}! Меня зовут [ВАШЕ ИМЯ], компания Auto Broker - пригон автомобилей из Европы.
Вы оставляли заявку на пригон автомобиля. Удобно ли вам сейчас говорить?"

ЕСЛИ ДА:
✅ "Отлично! Давайте я соберу всю информацию, чтобы подобрать идеальный вариант для вас."

ЕСЛИ НЕТ:
⏰ "Понимаю. Когда вам будет удобно? Могу перезвонить в..."
→ Записать удобное время

━━━━━━━━━━━━━━━━
📋 СОБРАТЬ ВСЮ ИНФОРМАЦИЮ:

1️⃣ КОНТАКТНЫЕ ДАННЫЕ:
- Полное имя: ${lead.name || '_______'}
- Email: ${lead.email || '_______'}
- Телефон: ${lead.phone || '_______'}
- Telegram: ${lead.telegramUsername || '_______'}

2️⃣ ПРЕДПОЧТЕНИЯ ПО АВТОМОБИЛЮ:
- Марки (через запятую): _______
- Модели (через запятую): _______
- Год от: _______
- Год до: _______
- Максимальный пробег: _______ км
- Тип кузова: _______
- Коробка передач: _______
- Тип топлива: _______

3️⃣ БЮДЖЕТ И СРОКИ:
- Бюджет от: _______ ₽
- Бюджет до: _______ ₽
- Когда планирует покупку: _______
- Срочность: _______

4️⃣ ДОСТАВКА:
- Регион: _______
- Город: _______

📝 ЧТО ОТМЕТИТЬ О ЗВОНКЕ:
- Дата/время звонка: _______
- Клиент взял трубку: Да/Нет
- Удобное время для разговора: _______
- Результат звонка: _______

⚡ ДЕДЛАЙН: 2 часа с момента создания лида
        `,
        taskType: TaskType.FIRST_CONTACT,
        status: TaskStatus.PENDING,
        dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // Через 2 часа
        taskData: {
          step: 1,
          // Контактные данные
          fullName: lead.name || null,
          email: lead.email || null,
          phone: lead.phone || null,
          telegram: lead.telegramUsername || null,
          // Предпочтения по авто
          preferredBrands: null,
          preferredModels: null,
          preferredYearFrom: null,
          preferredYearTo: null,
          preferredMileageMax: null,
          bodyType: null,
          gearbox: null,
          fuelType: null,
          // Бюджет и сроки
          budgetMin: null,
          budgetMax: null,
          purchaseTimeline: null,
          urgency: null,
          // Доставка
          region: null,
          city: null,
          // Информация о звонке
          callDateTime: null,
          clientAnswered: null,
          convenientTime: null,
          callResult: null,
        },
      },
      
      // ===== ЗАДАЧА 2: Предложить варианты и собрать реакции =====
      {
        leadId,
        adminId,
        title: '2️⃣ Предложить варианты - собрать реакции',
        description: `
🎯 ЦЕЛЬ: Предложить клиенту конкретные варианты и понять его предпочтения

📋 ЧТО СДЕЛАТЬ:
━━━━━━━━━━━━━━━━
1. Подобрать 3-5 автомобилей по критериям клиента
2. Подготовить описание каждого авто:
   - Фото (минимум 5-10 штук)
   - Характеристики
   - Цена "под ключ"
   - Сроки доставки
3. Отправить клиенту (email/Telegram)

💬 ТЕКСТ СООБЩЕНИЯ:
"Здравствуйте! Подобрал для вас несколько вариантов:

[Список автомобилей с фото и ценами]

Все цены указаны 'под ключ' - включают доставку и растаможку.
Какой вариант вам больше нравится?"

━━━━━━━━━━━━━━━━
📊 СОБРАТЬ РЕАКЦИИ:

1️⃣ ОТПРАВКА ВАРИАНТОВ:
- Количество отправленных вариантов: _______
- Дата отправки: _______
- Способ отправки: Email/Telegram/Другое

2️⃣ РЕАКЦИЯ КЛИЕНТА:
- Реакция на варианты: Заинтересован/Сомневается/Не подошло/Не ответил
- Какой вариант понравился больше всего: _______
- Что не устроило: _______
- Нужны ли дополнительные варианты: Да/Нет

3️⃣ ВОЗРАЖЕНИЯ (если есть):
- Тип возражения: Цена/Сроки/Качество/Документы/Другое
- Ответ на возражение: _______
- Результат: Согласен/Еще думает/Отказ

4️⃣ СЛЕДУЮЩИЕ ШАГИ:
- Что показать дальше: Больше вариантов/Дополнительные фото/Расчет стоимости/Другое
- Когда связаться снова: _______

⚡ ДЕДЛАЙН: 7 дней
        `,
        taskType: TaskType.SEND_OFFERS,
        status: TaskStatus.PENDING,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        taskData: {
          step: 2,
          offersCount: null,
          offersSentDate: null,
          offersMethod: null,
          clientReaction: null,
          likedVariant: null,
          objections: null,
          objectionType: null,
          objectionResponse: null,
          objectionResult: null,
          nextStep: null,
          nextContactDate: null,
        },
      },
      
      // ===== ЗАДАЧА 3: Отправить договор и получить предоплату =====
      {
        leadId,
        adminId,
        title: '3️⃣ Отправить договор - получить предоплату',
        description: `
🎯 ЦЕЛЬ: Оформить сделку официально и закрепить предоплатой

📋 ЧТО ОТПРАВИТЬ:
━━━━━━━━━━━━━━━━
1. Договор купли-продажи
2. Инструкцию по оплате
3. График платежей (если рассрочка)
4. Список документов для оформления
5. Детальный расчет стоимости "под ключ"

💬 ТЕКСТ СООБЩЕНИЯ:
"Отправляю договор и расчет для ознакомления.

[Детальный расчет стоимости "под ключ"]
- Стоимость автомобиля: _____ €
- Доставка до границы: _____ €
- Растаможка: _____ ₽
- Доставка по России: _____ ₽
- Оформление в ГИБДД: _____ ₽
- ИТОГО: _____ ₽

Все расходы включены. Никаких скрытых платежей.

Для начала работы нужна предоплата [сумма]₽.
Это гарантирует, что автомобиль будет зарезервирован за вами.
Остаток оплачивается при получении.

Вопросы по договору или расчету?"

━━━━━━━━━━━━━━━━
📝 ОТМЕТИТЬ:

1️⃣ ОТПРАВКА ДОКУМЕНТОВ:
- Дата отправки договора: _______
- Дата отправки расчета: _______
- Способ отправки: Email/Telegram/Другое

2️⃣ ПРЕДОПЛАТА:
- Сумма предоплаты: _______ ₽
- Дата получения: _______
- Способ оплаты: Банковский перевод/Карта/Наличные
- Статус оплаты: Получена/Ожидается/Не получена

3️⃣ ПОДТВЕРЖДЕНИЕ СДЕЛКИ:
- Договор подписан: Да/Нет/В процессе
- Все условия согласованы: Да/Нет
- Готовность начать оформление: Да/Нет

⚡ ДЕДЛАЙН: 7 дней
        `,
        taskType: TaskType.SEND_CONTRACT,
        status: TaskStatus.PENDING,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        taskData: {
          step: 3,
          contractSentDate: null,
          calculationSentDate: null,
          contractMethod: null,
          prepaymentAmount: null,
          prepaymentDate: null,
          paymentMethod: null,
          paymentStatus: null,
          contractSigned: null,
          dealConfirmed: null,
          readyToStart: null,
        },
      },
    ];

    // Создаем задачи последовательно
    for (const taskData of defaultTasks) {
      if (existingTaskTypes.has(taskData.taskType)) {
        continue;
      }
      await this.createTask(taskData);
      existingTaskTypes.add(taskData.taskType);
    }
  }

  private async ensureTasksForAdminLeads(targetAdminId: number, admin?: AdminEntity): Promise<void> {
    const isLeadManager = admin?.permissions?.isLeadManager || false;

    const queryBuilder = this.leadRepository
      .createQueryBuilder('lead')
      .leftJoin('lead.tasks', 'task')
      .where('lead.assignedAdminId IS NOT NULL');

    if (!admin?.isSuper && !isLeadManager) {
      queryBuilder.andWhere('lead.assignedAdminId = :adminId', { adminId: targetAdminId });
    }

    queryBuilder.groupBy('lead.id').having('COUNT(task.id) = 0');

    const leadsWithoutTasks = await queryBuilder.getMany();

    for (const lead of leadsWithoutTasks) {
      await this.createDefaultTasksForLead(lead.id, lead.assignedAdminId || targetAdminId);
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
        await this.createDefaultTasksForLead(
          lead.id,
          lead.assignedAdminId,
        );
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
    await this.ensureTasksForAdminLeads(adminId, admin);

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

  // Очистить старые задачи и создать новые 3 задачи для существующих лидов
  async migrateTasksToNewSystem(leadId?: number): Promise<{ updated: number; deleted: number }> {
    const queryBuilder = this.leadRepository.createQueryBuilder('lead');
    
    if (leadId) {
      queryBuilder.where('lead.id = :leadId', { leadId });
    }
    
    const leads = await queryBuilder.getMany();
    let updatedCount = 0;
    let deletedCount = 0;

    for (const lead of leads) {
      if (!lead.assignedAdminId) {
        continue;
      }

      // Получаем все задачи лида
      const existingTasks = await this.leadTaskRepository.find({
        where: { leadId: lead.id },
      });

      // Определяем типы новых задач
      const newTaskTypes = [
        TaskType.FIRST_CONTACT,
        TaskType.SEND_OFFERS,
        TaskType.SEND_CONTRACT,
      ];

      // Удаляем старые задачи, которые не входят в новые 3
      const tasksToDelete = existingTasks.filter(
        (task) => !newTaskTypes.includes(task.taskType),
      );

      if (tasksToDelete.length > 0) {
        await this.leadTaskRepository.remove(tasksToDelete);
        deletedCount += tasksToDelete.length;
      }

      // Создаем новые 3 задачи, если их нет
      await this.createDefaultTasksForLead(lead.id, lead.assignedAdminId);
      
      const finalTasks = await this.leadTaskRepository.find({
        where: { leadId: lead.id },
      });

      // Проверяем, что у нас есть все 3 новые задачи
      const hasAllNewTasks = newTaskTypes.every((type) =>
        finalTasks.some((task) => task.taskType === type),
      );

      if (hasAllNewTasks) {
        updatedCount++;
      }
    }

    return { updated: updatedCount, deleted: deletedCount };
  }
}

