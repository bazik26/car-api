import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:4200',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:4202',
      'https://car-client-production.up.railway.app',
      'https://car-client-old-production.up.railway.app',
      'https://car-client-2-production.up.railway.app',
      'https://car-client-3-production.up.railway.app',
      'https://car-admin-production-7255.up.railway.app',
      'https://car-promo-1-production.up.railway.app',
      'https://adenatrans.ru',
      'https://www.adenatrans.ru',
      'https://vamauto.com',
      'https://www.vamauto.com',
      'https://prime-autos.ru',
      'https://www.prime-autos.ru',
      'https://auto-c-cars.ru',
      'https://www.auto-c-cars.ru',
      'https://shop-ytb-client.onrender.com',
      'https://autobroker-yar.ru',
      'https://www.autobroker-yar.ru',
      'https://putinxuylo.ru',
      'https://www.putinxuylo.ru'
    ],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedClients = new Map<string, { sessionId: string; userType: string; adminId?: number }>();

  constructor(private readonly chatService: ChatService) {}

  async handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    const clientInfo = this.connectedClients.get(client.id);
    if (clientInfo) {
      this.connectedClients.delete(client.id);
      console.log(`Client disconnected: ${client.id}`);
    }
  }

  @SubscribeMessage('join-session')
  async handleJoinSession(
    @MessageBody() data: { sessionId: string; userType: 'client' | 'admin'; adminId?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const { sessionId, userType, adminId } = data;
    
    // Сохраняем информацию о клиенте
    this.connectedClients.set(client.id, { sessionId, userType, adminId });
    
    // Присоединяемся к комнате сессии
    client.join(sessionId);
    
    console.log(`Client ${client.id} joined session ${sessionId} as ${userType}`);
    
    // Уведомляем других участников сессии
    client.to(sessionId).emit('user-joined', { userType, adminId });
  }

  @SubscribeMessage('send-message')
  async handleSendMessage(
    @MessageBody() data: {
      sessionId: string;
      message: string;
      senderType: 'client' | 'admin';
      clientName?: string;
      clientEmail?: string;
      clientPhone?: string;
      adminId?: number;
      projectSource?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const { sessionId, message, senderType, clientName, clientEmail, clientPhone, adminId, projectSource } = data;
    
    try {
      // Сохраняем сообщение в базу данных
      const savedMessage = await this.chatService.sendMessage({
        sessionId,
        message,
        senderType,
        clientName,
        clientEmail,
        clientPhone,
        adminId,
        projectSource,
      });

      // Отправляем сообщение всем участникам сессии
      this.server.to(sessionId).emit('new-message', {
        id: savedMessage.id,
        sessionId: savedMessage.sessionId,
        message: savedMessage.message,
        senderType: savedMessage.senderType,
        clientName: savedMessage.clientName,
        clientEmail: savedMessage.clientEmail,
        clientPhone: savedMessage.clientPhone,
        adminId: savedMessage.adminId,
        isRead: savedMessage.isRead,
        createdAt: savedMessage.createdAt,
      });

      // Уведомляем админов о новом сообщении от клиента
      if (senderType === 'client') {
        this.server.emit('admin-notification', {
          type: 'new-message',
          sessionId,
          message: savedMessage.message,
          clientName: savedMessage.clientName,
          projectSource,
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  @SubscribeMessage('mark-as-read')
  async handleMarkAsRead(
    @MessageBody() data: { sessionId: string; adminId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const { sessionId, adminId } = data;
    
    try {
      await this.chatService.markMessagesAsRead(sessionId, adminId);
      
      // Уведомляем клиентов в сессии
      this.server.to(sessionId).emit('messages-read', { adminId });
    } catch (error) {
      console.error('Error marking messages as read:', error);
      client.emit('error', { message: 'Failed to mark messages as read' });
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { sessionId: string; userType: string; isTyping: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    const { sessionId, userType, isTyping } = data;
    
    // Уведомляем других участников сессии о наборе текста
    client.to(sessionId).emit('user-typing', { userType, isTyping });
  }

  @SubscribeMessage('get-session-messages')
  async handleGetSessionMessages(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { sessionId } = data;
    
    try {
      const messages = await this.chatService.getSessionMessages(sessionId);
      client.emit('session-messages', messages);
    } catch (error) {
      console.error('Error getting session messages:', error);
      client.emit('error', { message: 'Failed to get session messages' });
    }
  }
}

