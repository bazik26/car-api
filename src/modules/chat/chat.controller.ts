import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ChatService, ChatMessage, ChatSession } from './chat.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Создать новую сессию чата
  @Post('session')
  async createSession(@Body() sessionData: Partial<ChatSession>) {
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
  @Get('session/:sessionId')
  async getSession(@Param('sessionId') sessionId: string) {
    return await this.chatService.getSession(sessionId);
  }

  // Получить все активные сессии (только для админов)
  @Get('sessions')
  @UseGuards(AuthGuard)
  async getActiveSessions() {
    return await this.chatService.getActiveSessions();
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
  @Post('message')
  async sendMessage(@Body() messageData: ChatMessage) {
    return await this.chatService.sendMessage(messageData);
  }

  // Получить сообщения сессии
  @Get('messages/:sessionId')
  async getSessionMessages(@Param('sessionId') sessionId: string) {
    return await this.chatService.getSessionMessages(sessionId);
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

  // Закрыть сессию
  @Post('session/:sessionId/close')
  @UseGuards(AuthGuard)
  async closeSession(@Param('sessionId') sessionId: string) {
    await this.chatService.closeSession(sessionId);
    return { success: true };
  }
}
