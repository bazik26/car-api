import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessageEntity, ChatSessionEntity } from './chat.entity';
import { AdminEntity } from '../../db/admin.entity';
import { UserEntity } from '../../db/user.entity';
import { LeadService } from '../lead/lead.service';
import { LeadSource } from '../lead/lead.entity';

export interface ChatMessage {
  id?: number;
  sessionId: string;
  message: string;
  senderType: 'client' | 'admin';
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  adminId?: number;
  isRead?: boolean;
  projectSource?: string;
  createdAt?: Date;
}

export interface ChatSession {
  id?: number;
  sessionId: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  projectSource: string;
  isActive?: boolean;
  assignedAdminId?: number;
  lastMessageAt?: Date;
  unreadCount?: number;
  createdAt?: Date;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessageEntity)
    private chatMessageRepository: Repository<ChatMessageEntity>,
    @InjectRepository(ChatSessionEntity)
    private chatSessionRepository: Repository<ChatSessionEntity>,
    @InjectRepository(AdminEntity)
    private adminRepository: Repository<AdminEntity>,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @Inject(forwardRef(() => LeadService))
    private leadService: LeadService,
  ) {}


  // Создать или найти пользователя по фингерпринту
  async createOrFindUser(fingerprint: string, userData?: {
    name?: string;
    email?: string;
    phone?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<UserEntity> {
    console.log('ChatService: Creating or finding user with fingerprint:', fingerprint);
    
    try {
      let user = await this.userRepository.findOne({
        where: { fingerprint, isActive: true }
      });

      if (user) {
        // Обновляем время последнего визита
        user.lastSeenAt = new Date();
        if (userData?.name) user.name = userData.name;
        if (userData?.email) user.email = userData.email;
        if (userData?.phone) user.phone = userData.phone;
        user = await this.userRepository.save(user);
        console.log('ChatService: User found and updated:', user.id);
      } else {
        // Создаем нового пользователя
        user = this.userRepository.create({
          fingerprint,
          name: userData?.name,
          email: userData?.email,
          phone: userData?.phone,
          ipAddress: userData?.ipAddress,
          userAgent: userData?.userAgent,
          lastSeenAt: new Date(),
          isActive: true
        });
        user = await this.userRepository.save(user);
        console.log('ChatService: New user created:', user.id);
      }

      return user;
    } catch (error) {
      console.error('ChatService: Error creating/finding user:', error);
      throw error;
    }
  }

  // Создать новую сессию чата
  async createSession(sessionData: Partial<ChatSession> & {
    userFingerprint?: string;
    userData?: {
      name?: string;
      email?: string;
      phone?: string;
      ipAddress?: string;
      userAgent?: string;
    };
  }): Promise<ChatSessionEntity> {
    console.log('ChatService: Creating session with data:', sessionData);
    try {
      let user: UserEntity | null = null;
      
      // Если есть фингерпринт, создаем или находим пользователя
      if (sessionData.userFingerprint) {
        user = await this.createOrFindUser(sessionData.userFingerprint, sessionData.userData);
      }

      const session = this.chatSessionRepository.create({
        ...sessionData,
        userId: user?.id
      });
      const savedSession = await this.chatSessionRepository.save(session);
      console.log('ChatService: Session saved successfully:', savedSession);
      return savedSession;
    } catch (error) {
      console.error('ChatService: Error creating session:', error);
      throw error;
    }
  }

  // Получить сессию по ID
  async getSession(sessionId: string): Promise<ChatSessionEntity | null> {
    return await this.chatSessionRepository.findOne({
      where: { sessionId },
      relations: ['assignedAdmin', 'user']
    });
  }

  // Обновить данные сессии
  async updateSession(sessionId: string, updateData: {
    clientName?: string;
    clientEmail?: string;
    clientPhone?: string;
  }): Promise<ChatSessionEntity | null> {
    console.log('Updating session:', sessionId, 'with data:', updateData);
    
    try {
      const session = await this.chatSessionRepository.findOne({
        where: { sessionId }
      });

      if (!session) {
        console.log('Session not found:', sessionId);
        return null;
      }

      // Обновляем поля
      if (updateData.clientName !== undefined) {
        session.clientName = updateData.clientName;
      }
      if (updateData.clientEmail !== undefined) {
        session.clientEmail = updateData.clientEmail;
      }
      if (updateData.clientPhone !== undefined) {
        session.clientPhone = updateData.clientPhone;
      }

      const updatedSession = await this.chatSessionRepository.save(session);
      console.log('Session updated successfully:', updatedSession);
      return updatedSession;
    } catch (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  }

  // Получить историю чата пользователя по фингерпринту
  async getUserChatHistory(fingerprint: string): Promise<{
    user: UserEntity | null;
    sessions: ChatSessionEntity[];
    messages: ChatMessageEntity[];
  }> {
    console.log('ChatService: Getting chat history for fingerprint:', fingerprint);
    
    try {
      // Находим пользователя
      const user = await this.userRepository.findOne({
        where: { fingerprint, isActive: true }
      });

      if (!user) {
        return { user: null, sessions: [], messages: [] };
      }

      // Получаем все сессии пользователя
      const sessions = await this.chatSessionRepository.find({
        where: { userId: user.id },
        relations: ['assignedAdmin'],
        order: { createdAt: 'DESC' }
      });

      // Получаем все сообщения из всех сессий
      const sessionIds = sessions.map(s => s.sessionId);
      const messages = sessionIds.length > 0 ? await this.chatMessageRepository
        .createQueryBuilder('message')
        .where('message.sessionId IN (:...sessionIds)', { sessionIds })
        .orderBy('message.createdAt', 'ASC')
        .getMany() : [];

      console.log('ChatService: Found user history:', {
        userId: user.id,
        sessionsCount: sessions.length,
        messagesCount: messages.length
      });

      return { user, sessions, messages };
    } catch (error) {
      console.error('ChatService: Error getting user chat history:', error);
      throw error;
    }
  }

  // Получить все активные сессии
  async getActiveSessions(): Promise<ChatSessionEntity[]> {
    return await this.chatSessionRepository.find({
      where: { isActive: true },
      relations: ['assignedAdmin'],
      order: { lastMessageAt: 'DESC' }
    });
  }

  // Назначить админа на сессию
  async assignAdminToSession(sessionId: string, adminId: number): Promise<ChatSessionEntity> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.assignedAdminId = adminId;
      return await this.chatSessionRepository.save(session);
    }
    throw new Error('Session not found');
  }

  // Отправить сообщение
  async sendMessage(messageData: ChatMessage): Promise<ChatMessageEntity> {
    console.log('ChatService: Creating message with data:', JSON.stringify(messageData, null, 2));
    try {
      // Проверяем, что все необходимые поля присутствуют
      if (!messageData.sessionId) {
        throw new Error('sessionId is required');
      }
      if (!messageData.message) {
        throw new Error('message is required');
      }
      if (!messageData.senderType) {
        throw new Error('senderType is required');
      }

      console.log('ChatService: Validating message data...');
      
      // Проверяем, существует ли админ, если указан adminId
      let validAdminId: number | null = null;
      if (messageData.adminId) {
        const admin = await this.adminRepository.findOne({ where: { id: messageData.adminId } });
        if (admin) {
          validAdminId = messageData.adminId;
          console.log('ChatService: Admin found:', admin.id);
        } else {
          console.warn('ChatService: Admin not found with ID:', messageData.adminId);
        }
      }
      
      // Создаем сообщение без лишних полей
      const cleanMessageData: Partial<ChatMessageEntity> = {
        sessionId: messageData.sessionId,
        message: messageData.message,
        senderType: messageData.senderType,
        clientName: messageData.clientName,
        clientEmail: messageData.clientEmail,
        clientPhone: messageData.clientPhone,
        adminId: validAdminId || undefined,
        projectSource: messageData.projectSource
      };
      
      const message = this.chatMessageRepository.create(cleanMessageData);
      console.log('ChatService: Message entity created:', JSON.stringify(message, null, 2));
      
      console.log('ChatService: Saving message to database...');
      const savedMessage = await this.chatMessageRepository.save(message);
      console.log('ChatService: Message saved successfully:', JSON.stringify(savedMessage, null, 2));
      
      // Убеждаемся, что возвращаем правильный тип
      if (Array.isArray(savedMessage)) {
        return savedMessage[0];
      }

      // Обновить сессию
      console.log('ChatService: Updating session...');
      const session = await this.getSession(messageData.sessionId);
      if (session) {
        session.lastMessageAt = new Date();
        if (messageData.senderType === 'client') {
          session.unreadCount += 1;
          
          // Обновляем данные клиента в сессии, если они указаны
          if (messageData.clientName) session.clientName = messageData.clientName;
          if (messageData.clientEmail) session.clientEmail = messageData.clientEmail;
          if (messageData.clientPhone) session.clientPhone = messageData.clientPhone;
        }
        await this.chatSessionRepository.save(session);
        console.log('ChatService: Session updated successfully');
        
        // Автоматически создаем лид, если клиент оставил контакты
        if (messageData.senderType === 'client' && 
            messageData.clientName && 
            (messageData.clientPhone || messageData.clientEmail)) {
          try {
            await this.createLeadFromSessionIfNeeded(session);
          } catch (error) {
            console.error('ChatService: Error creating lead from session:', error);
            // Не прерываем выполнение, если не удалось создать лид
          }
        }
      } else {
        console.warn('ChatService: Session not found for sessionId:', messageData.sessionId);
      }

      return savedMessage;
    } catch (error) {
      console.error('ChatService: Error in sendMessage:', error);
      console.error('ChatService: Error stack:', error.stack);
      console.error('ChatService: Error message:', error.message);
      throw error;
    }
  }

  // Получить сообщения сессии
  async getSessionMessages(sessionId: string): Promise<ChatMessageEntity[]> {
    return await this.chatMessageRepository.find({
      where: { sessionId },
      order: { createdAt: 'ASC' }
    });
  }

  // Получить непрочитанные сообщения для админа
  async getUnreadMessagesForAdmin(adminId: number): Promise<ChatMessageEntity[]> {
    return await this.chatMessageRepository.find({
      where: { 
        adminId,
        isRead: false,
        senderType: 'client'
      },
      order: { createdAt: 'DESC' }
    });
  }

  // Отметить сообщения как прочитанные
  async markMessagesAsRead(sessionId: string, adminId: number): Promise<void> {
    await this.chatMessageRepository.update(
      { sessionId, senderType: 'client' },
      { isRead: true }
    );

    // Обновить счетчик непрочитанных в сессии
    const session = await this.getSession(sessionId);
    if (session) {
      session.unreadCount = 0;
      await this.chatSessionRepository.save(session);
    }
  }

  // Получить статистику чата
  async getChatStats() {
    const totalSessions = await this.chatSessionRepository.count({ where: { isActive: true } });
    const totalMessages = await this.chatMessageRepository.count();
    const unreadMessages = await this.chatMessageRepository.count({ 
      where: { isRead: false, senderType: 'client' } 
    });

    return {
      totalSessions,
      totalMessages,
      unreadMessages
    };
  }

  // Получить сессии по проекту
  async getSessionsByProject(projectSource: string): Promise<ChatSessionEntity[]> {
    return await this.chatSessionRepository.find({
      where: { projectSource, isActive: true },
      relations: ['assignedAdmin'],
      order: { lastMessageAt: 'DESC' }
    });
  }

  // Получить всех админов
  async getAdmins(): Promise<AdminEntity[]> {
    return await this.adminRepository.find();
  }

  // Закрыть сессию
  async closeSession(sessionId: string): Promise<void> {
    await this.chatSessionRepository.update(
      { sessionId },
      { isActive: false }
    );
  }

  // Автоматически создать лид из сессии, если есть контакты
  private async createLeadFromSessionIfNeeded(session: ChatSessionEntity): Promise<void> {
    // Проверяем, что есть имя и хотя бы один контакт
    if (!session.clientName || (!session.clientPhone && !session.clientEmail)) {
      return;
    }

    try {
      // Используем метод createLeadFromChatSession, который проверяет дубликаты
      await this.leadService.createLeadFromChatSession(
        session.sessionId,
        session.assignedAdminId || undefined
      );
      console.log('ChatService: Lead automatically created from chat session:', session.sessionId);
    } catch (error) {
      // Если лид уже существует, это нормально
      if (error.message && error.message.includes('already exists')) {
        return;
      }
      throw error;
    }
  }
}
