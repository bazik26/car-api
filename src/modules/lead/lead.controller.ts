import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { LeadService, CreateLeadDto, UpdateLeadDto, CreateLeadCommentDto } from './lead.service';
import { AuthGuard } from '../auth/auth.guard';
import { LeadStatus, LeadSource } from './lead.entity';

@Controller('leads')
@UseGuards(AuthGuard)
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  // Создать лид
  @Post()
  async createLead(@Body() createLeadDto: CreateLeadDto) {
    return await this.leadService.createLead(createLeadDto);
  }

  // Создать лид из чат-сессии
  @Post('from-chat/:chatSessionId')
  async createLeadFromChat(
    @Param('chatSessionId') chatSessionId: string,
    @Body() body?: { assignedAdminId?: number },
  ) {
    return await this.leadService.createLeadFromChatSession(
      chatSessionId,
      body?.assignedAdminId,
    );
  }

  // Получить все лиды
  @Get()
  async getAllLeads(
    @Query('status') status?: LeadStatus,
    @Query('source') source?: LeadSource,
    @Query('assignedAdminId') assignedAdminId?: number,
    @Query('search') search?: string,
  ) {
    return await this.leadService.getAllLeads({
      status,
      source,
      assignedAdminId: assignedAdminId ? parseInt(String(assignedAdminId)) : undefined,
      search,
    });
  }

  // Получить лид по ID
  @Get(':id')
  async getLeadById(@Param('id', ParseIntPipe) id: number) {
    return await this.leadService.getLeadById(id);
  }

  // Обновить лид
  @Put(':id')
  async updateLead(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLeadDto: UpdateLeadDto,
  ) {
    return await this.leadService.updateLead(id, updateLeadDto);
  }

  // Удалить лид
  @Delete(':id')
  async deleteLead(@Param('id', ParseIntPipe) id: number) {
    await this.leadService.deleteLead(id);
    return { success: true };
  }

  // Создать комментарий
  @Post(':id/comments')
  async createComment(
    @Param('id', ParseIntPipe) leadId: number,
    @Body() body: { adminId: number; comment: string },
  ) {
    const createCommentDto: CreateLeadCommentDto = {
      leadId,
      adminId: body.adminId,
      comment: body.comment,
    };
    return await this.leadService.createComment(createCommentDto);
  }

  // Получить комментарии лида
  @Get(':id/comments')
  async getLeadComments(@Param('id', ParseIntPipe) leadId: number) {
    return await this.leadService.getLeadComments(leadId);
  }

  // Удалить комментарий
  @Delete('comments/:commentId')
  async deleteComment(@Param('commentId', ParseIntPipe) commentId: number) {
    await this.leadService.deleteComment(commentId);
    return { success: true };
  }

  // Получить статистику лидов
  @Get('stats/summary')
  async getLeadsStats() {
    return await this.leadService.getLeadsStats();
  }
}


