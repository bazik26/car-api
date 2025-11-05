import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadEntity, LeadCommentEntity } from './lead.entity';
import { LeadService } from './lead.service';
import { LeadController } from './lead.controller';
import { AdminEntity } from '../../db/admin.entity';
import { ChatSessionEntity } from '../chat/chat.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LeadEntity,
      LeadCommentEntity,
      AdminEntity,
      ChatSessionEntity,
    ]),
  ],
  controllers: [LeadController],
  providers: [LeadService],
  exports: [LeadService],
})
export class LeadModule {}

