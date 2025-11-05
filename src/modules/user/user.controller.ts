import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { UserService, UserFingerprint } from './user.service';
import { AuthGuard } from '../auth/auth.guard';
import { Public } from '../auth/public.decorator';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // Создать или обновить пользователя по фингерпринту
  @Public()
  @Post('fingerprint')
  async createOrUpdateUser(@Body() fingerprintData: UserFingerprint) {
    console.log('UserController: Creating/updating user with data:', fingerprintData);
    try {
      const user = await this.userService.createOrUpdateUser(fingerprintData);
      console.log('UserController: User created/updated successfully:', user.id);
      return user;
    } catch (error) {
      console.error('UserController: Error creating/updating user:', error);
      throw error;
    }
  }

  // Получить пользователя по фингерпринту
  @Public()
  @Get('fingerprint/:fingerprint')
  async getUserByFingerprint(@Param('fingerprint') fingerprint: string) {
    return await this.userService.getUserByFingerprint(fingerprint);
  }

  // Получить пользователя по ID
  @Get(':id')
  @UseGuards(AuthGuard)
  async getUserById(@Param('id') id: number) {
    return await this.userService.getUserById(id);
  }

  // Получить всех активных пользователей (только для админов)
  @Get('active/list')
  @UseGuards(AuthGuard)
  async getActiveUsers() {
    return await this.userService.getActiveUsers();
  }

  // Обновить время последнего визита
  @Public()
  @Post('fingerprint/:fingerprint/seen')
  async updateLastSeen(@Param('fingerprint') fingerprint: string) {
    await this.userService.updateUserLastSeen(fingerprint);
    return { success: true };
  }
}










