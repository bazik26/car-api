import { join } from 'path';

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';

import { AdminEntity } from './db/admin.entity';
import { CarEntity } from './db/car.entity';
import { FileEntity } from './db/file.entity';
import { UserEntity } from './db/user.entity';
import { ChatMessageEntity, ChatSessionEntity } from './modules/chat/chat.entity';
import { LeadEntity, LeadCommentEntity } from './modules/lead/lead.entity';
import { LeadActivityEntity } from './modules/lead/lead-activity.entity';
import { LeadTaskEntity } from './modules/lead/lead-task.entity';
import { LeadTagEntity } from './modules/lead/lead-tag.entity';
import { LeadAttachmentEntity } from './modules/lead/lead-attachment.entity';
import { LeadMeetingEntity } from './modules/lead/lead-meeting.entity';
import { AdminModule } from './modules/admin/admin.module';

import { AuthModule } from './modules/auth/auth.module';
import { CarModule } from './modules/car/car.module';
import { StatsModule } from './modules/stats/stats.module';
import { ChatModule } from './modules/chat/chat.module';
import { UserModule } from './modules/user/user.module';
import { LeadModule } from './modules/lead/lead.module';

import { AppController } from './app.controller';
import { AppService } from './app.service';

const ENTITIES = [
  AdminEntity,
  CarEntity,
  FileEntity,
  UserEntity,
  ChatMessageEntity,
  ChatSessionEntity,
  LeadEntity,
  LeadCommentEntity,
  LeadActivityEntity,
  LeadTaskEntity,
  LeadTagEntity,
  LeadAttachmentEntity,
  LeadMeetingEntity,
];

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.MYSQLHOST || 'localhost',
      port: Number(process.env.MYSQLPORT ?? 3306),
      database: process.env.MYSQLDATABASE || 'auto',
      username: process.env.MYSQLUSER || 'root',
      password: process.env.MYSQLPASSWORD || 'root',
      entities: ENTITIES,
      synchronize: true,
    }),

    TypeOrmModule.forFeature(ENTITIES),

    ServeStaticModule.forRoot({
      rootPath: process.env.UPLOAD_DIR || join(process.cwd(), 'images'),
      serveRoot: '/',
    }),

    AdminModule,
    AuthModule,
    CarModule,
    StatsModule,
    ChatModule,
    UserModule,
    LeadModule,
  ],

  controllers: [AppController],
  providers: [AppService],
  exports: [AppService],
})
export class AppModule {}
