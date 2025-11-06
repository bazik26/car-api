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
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LeadService, CreateLeadDto, UpdateLeadDto, CreateLeadCommentDto } from './lead.service';
import { AuthGuard } from '../auth/auth.guard';
import { Public } from '../auth/public.decorator';
import { LeadStatus, LeadSource } from './lead.entity';
import { MeetingType } from './lead-meeting.entity';

@Controller('leads')
@UseGuards(AuthGuard)
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  // Создать лид
  @Post()
  async createLead(@Body() createLeadDto: CreateLeadDto, @Req() req?: any) {
    const adminId = req?.user?.id;
    const admin = req?.user;
    return await this.leadService.createLead(createLeadDto, adminId, admin);
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
    @Req() req?: any,
  ) {
    const admin = req?.user;
    return await this.leadService.getAllLeads({
      status,
      source,
      assignedAdminId: assignedAdminId ? parseInt(String(assignedAdminId)) : undefined,
      search,
    }, admin);
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
    @Req() req?: any,
  ) {
    const adminId = req?.user?.id;
    const admin = req?.user;
    return await this.leadService.updateLead(id, updateLeadDto, adminId, admin);
  }

  // Удалить лид
  @Delete(':id')
  async deleteLead(@Param('id', ParseIntPipe) id: number, @Req() req?: any) {
    const admin = req?.user;
    await this.leadService.deleteLead(id, admin);
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

  // Получить количество необработанных лидов
  @Get('stats/unprocessed-count')
  @Public()
  async getUnprocessedLeadsCount(@Req() req?: any) {
    const admin = req?.user;
    const count = await this.leadService.getUnprocessedLeadsCount(admin);
    return { count };
  }

  // ==================== ACTIVITY LOG ====================

  @Get(':id/activities')
  async getLeadActivities(@Param('id', ParseIntPipe) leadId: number) {
    return await this.leadService.getLeadActivities(leadId);
  }

  // ==================== TASKS ====================

  @Post(':id/tasks')
  async createTask(
    @Param('id', ParseIntPipe) leadId: number,
    @Body() body: { adminId: number; title: string; description?: string; dueDate?: string },
  ) {
    return await this.leadService.createTask({
      leadId,
      adminId: body.adminId,
      title: body.title,
      description: body.description,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    });
  }

  @Get(':id/tasks')
  async getLeadTasks(@Param('id', ParseIntPipe) leadId: number) {
    return await this.leadService.getLeadTasks(leadId);
  }

  @Put('tasks/:taskId')
  async updateTask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() body: { title?: string; description?: string; dueDate?: string; completed?: boolean },
    @Req() req?: any,
  ) {
    const adminId = req?.user?.id;
    return await this.leadService.updateTask(
      taskId,
      {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      },
      adminId,
    );
  }

  @Delete('tasks/:taskId')
  async deleteTask(@Param('taskId', ParseIntPipe) taskId: number) {
    await this.leadService.deleteTask(taskId);
    return { success: true };
  }

  // ==================== TAGS ====================

  @Get('tags/all')
  async getAllTags() {
    return await this.leadService.getAllTags();
  }

  @Post('tags')
  async createTag(@Body() body: { name: string; color?: string }) {
    return await this.leadService.createTag(body.name, body.color);
  }

  @Post(':id/tags/:tagId')
  async addTagToLead(
    @Param('id', ParseIntPipe) leadId: number,
    @Param('tagId', ParseIntPipe) tagId: number,
    @Req() req?: any,
  ) {
    const adminId = req?.user?.id;
    return await this.leadService.addTagToLead(leadId, tagId, adminId);
  }

  @Delete(':id/tags/:tagId')
  async removeTagFromLead(
    @Param('id', ParseIntPipe) leadId: number,
    @Param('tagId', ParseIntPipe) tagId: number,
    @Req() req?: any,
  ) {
    const adminId = req?.user?.id;
    return await this.leadService.removeTagFromLead(leadId, tagId, adminId);
  }

  // ==================== ATTACHMENTS ====================

  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file'))
  async createAttachment(
    @Param('id', ParseIntPipe) leadId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { description?: string },
    @Req() req?: any,
  ) {
    // В реальном приложении нужно сохранить файл и получить путь
    // Здесь упрощенная версия
    const adminId = req?.user?.id;
    return await this.leadService.createAttachment({
      leadId,
      adminId,
      fileName: file.originalname,
      filePath: file.path || `/uploads/${file.filename}`,
      fileSize: file.size,
      mimeType: file.mimetype,
      description: body.description,
    });
  }

  @Get(':id/attachments')
  async getLeadAttachments(@Param('id', ParseIntPipe) leadId: number) {
    return await this.leadService.getLeadAttachments(leadId);
  }

  @Delete('attachments/:attachmentId')
  async deleteAttachment(@Param('attachmentId', ParseIntPipe) attachmentId: number) {
    await this.leadService.deleteAttachment(attachmentId);
    return { success: true };
  }

  // ==================== MEETINGS ====================

  @Post(':id/meetings')
  async createMeeting(
    @Param('id', ParseIntPipe) leadId: number,
    @Body()
    body: {
      adminId: number;
      title: string;
      description?: string;
      meetingDate: string;
      location?: string;
      meetingType?: MeetingType;
    },
  ) {
    return await this.leadService.createMeeting({
      leadId,
      adminId: body.adminId,
      title: body.title,
      description: body.description,
      meetingDate: new Date(body.meetingDate),
      location: body.location,
      meetingType: body.meetingType || MeetingType.CALL,
    });
  }

  @Get(':id/meetings')
  async getLeadMeetings(@Param('id', ParseIntPipe) leadId: number) {
    return await this.leadService.getLeadMeetings(leadId);
  }

  @Put('meetings/:meetingId')
  async updateMeeting(
    @Param('meetingId', ParseIntPipe) meetingId: number,
    @Body()
    body: {
      title?: string;
      description?: string;
      meetingDate?: string;
      location?: string;
      meetingType?: MeetingType;
      completed?: boolean;
    },
  ) {
    return await this.leadService.updateMeeting(meetingId, {
      ...body,
      meetingDate: body.meetingDate ? new Date(body.meetingDate) : undefined,
    });
  }

  @Delete('meetings/:meetingId')
  async deleteMeeting(@Param('meetingId', ParseIntPipe) meetingId: number) {
    await this.leadService.deleteMeeting(meetingId);
    return { success: true };
  }

  // ==================== LEAD SCORING ====================

  @Post(':id/calculate-score')
  async calculateLeadScore(@Param('id', ParseIntPipe) leadId: number) {
    const score = await this.leadService.calculateLeadScore(leadId);
    return { score };
  }

  @Post(':id/convert-to-client')
  async convertLeadToClient(@Param('id', ParseIntPipe) leadId: number, @Req() req?: any) {
    const adminId = req?.user?.id;
    return await this.leadService.convertLeadToClient(leadId, adminId);
  }
}


