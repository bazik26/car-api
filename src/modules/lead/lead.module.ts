import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadEntity, LeadCommentEntity } from './lead.entity';
import { LeadActivityEntity } from './lead-activity.entity';
import { LeadTaskEntity } from './lead-task.entity';
import { LeadTagEntity } from './lead-tag.entity';
import { LeadAttachmentEntity } from './lead-attachment.entity';
import { LeadMeetingEntity } from './lead-meeting.entity';
import { LeadService } from './lead.service';
import { LeadController } from './lead.controller';
import { AdminEntity } from '../../db/admin.entity';
import { ChatSessionEntity } from '../chat/chat.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LeadEntity,
      LeadCommentEntity,
      LeadActivityEntity,
      LeadTaskEntity,
      LeadTagEntity,
      LeadAttachmentEntity,
      LeadMeetingEntity,
      AdminEntity,
      ChatSessionEntity,
    ]),
  ],
  controllers: [LeadController],
  providers: [LeadService],
  exports: [LeadService],
})
export class LeadModule {}


