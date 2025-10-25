import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatMessageEntity, ChatSessionEntity } from './chat.entity';
import { UserEntity } from '../../db/user.entity';
import { AdminEntity } from '../../db/admin.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessageEntity, ChatSessionEntity, AdminEntity, UserEntity])
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService, ChatGateway]
})
export class ChatModule {}
