import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ChatService, ChatMessage, ChatSession } from './chat.service';
import { AuthGuard } from '../auth/auth.guard';
import { Public } from '../auth/public.decorator';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Создать новую сессию чата
  @Public()
  @Post('session')
  async createSession(@Body() sessionData: Partial<ChatSession> & {
    userFingerprint?: string;
    userData?: {
      name?: string;
      email?: string;
      phone?: string;
      ipAddress?: string;
      userAgent?: string;
    };
  }) {
    console.log('Creating chat session:', sessionData);
    try {
      const session = await this.chatService.createSession(sessionData);
      console.log('Session created successfully:', session);
      return session;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  // Получить сессию
  @Public()
  @Get('session/:sessionId')
  async getSession(@Param('sessionId') sessionId: string) {
    return await this.chatService.getSession(sessionId);
  }

  // Получить все активные сессии (только для админов)
  @Get('sessions')
  @UseGuards(AuthGuard)
  async getActiveSessions() {
    console.log('Loading active sessions for admin');
    try {
      const sessions = await this.chatService.getActiveSessions();
      console.log('Active sessions found:', sessions.length);
      return sessions;
    } catch (error) {
      console.error('Error loading active sessions:', error);
      throw error;
    }
  }

  // Получить сессии по проекту
  @Get('sessions/project/:projectSource')
  @UseGuards(AuthGuard)
  async getSessionsByProject(@Param('projectSource') projectSource: string) {
    return await this.chatService.getSessionsByProject(projectSource);
  }

  // Назначить админа на сессию
  @Post('session/:sessionId/assign')
  @UseGuards(AuthGuard)
  async assignAdminToSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { adminId: number }
  ) {
    return await this.chatService.assignAdminToSession(sessionId, body.adminId);
  }

  // Отправить сообщение
  @Public()
  @Post('message')
  async sendMessage(@Body() messageData: ChatMessage) {
    console.log('Received message data:', messageData);
    try {
      const message = await this.chatService.sendMessage(messageData);
      console.log('Message saved successfully:', message);
      return message;
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  }

  // Получить сообщения сессии
  @Public()
  @Get('messages/:sessionId')
  async getSessionMessages(@Param('sessionId') sessionId: string) {
    console.log('Loading messages for session:', sessionId);
    try {
      const messages = await this.chatService.getSessionMessages(sessionId);
      console.log('Messages loaded successfully:', messages.length);
      return messages;
    } catch (error) {
      console.error('Error loading messages:', error);
      throw error;
    }
  }

  // Получить непрочитанные сообщения для админа
  @Get('unread/:adminId')
  @UseGuards(AuthGuard)
  async getUnreadMessagesForAdmin(@Param('adminId') adminId: number) {
    return await this.chatService.getUnreadMessagesForAdmin(adminId);
  }

  // Отметить сообщения как прочитанные
  @Post('read/:sessionId')
  @UseGuards(AuthGuard)
  async markMessagesAsRead(
    @Param('sessionId') sessionId: string,
    @Body() body: { adminId: number }
  ) {
    await this.chatService.markMessagesAsRead(sessionId, body.adminId);
    return { success: true };
  }

  // Получить статистику чата
  @Get('stats')
  @UseGuards(AuthGuard)
  async getChatStats() {
    return await this.chatService.getChatStats();
  }

  // Получить историю чата пользователя по фингерпринту
  @Public()
  @Get('history/:fingerprint')
  async getUserChatHistory(@Param('fingerprint') fingerprint: string) {
    console.log('Getting chat history for fingerprint:', fingerprint);
    try {
      const history = await this.chatService.getUserChatHistory(fingerprint);
      console.log('Chat history loaded successfully:', {
        user: history.user?.id,
        sessions: history.sessions.length,
        messages: history.messages.length
      });
      return history;
    } catch (error) {
      console.error('Error loading chat history:', error);
      throw error;
    }
  }

  // Тестовый эндпоинт для проверки работы
  @Public()
  @Get('test')
  async testEndpoint() {
    return { 
      message: 'Chat API is working', 
      timestamp: new Date().toISOString(),
      status: 'OK'
    };
  }

  // Закрыть сессию
  @Post('session/:sessionId/close')
  @UseGuards(AuthGuard)
  async closeSession(@Param('sessionId') sessionId: string) {
    await this.chatService.closeSession(sessionId);
    return { success: true };
  }
}
