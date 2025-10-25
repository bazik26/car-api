import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessageEntity, ChatSessionEntity } from './chat.entity';
import { AdminEntity } from '../../db/admin.entity';

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
  ) {}

  // Создать новую сессию чата
  async createSession(sessionData: Partial<ChatSession>): Promise<ChatSessionEntity> {
    const session = this.chatSessionRepository.create(sessionData);
    return await this.chatSessionRepository.save(session);
  }

  // Получить сессию по ID
  async getSession(sessionId: string): Promise<ChatSessionEntity | null> {
    return await this.chatSessionRepository.findOne({
      where: { sessionId },
      relations: ['assignedAdmin']
    });
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
    const message = this.chatMessageRepository.create(messageData);
    const savedMessage = await this.chatMessageRepository.save(message);

    // Обновить сессию
    const session = await this.getSession(messageData.sessionId);
    if (session) {
      session.lastMessageAt = new Date();
      if (messageData.senderType === 'client') {
        session.unreadCount += 1;
      }
      await this.chatSessionRepository.save(session);
    }

    return savedMessage;
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
      { sessionId, adminId: null },
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

  // Закрыть сессию
  async closeSession(sessionId: string): Promise<void> {
    await this.chatSessionRepository.update(
      { sessionId },
      { isActive: false }
    );
  }
}
