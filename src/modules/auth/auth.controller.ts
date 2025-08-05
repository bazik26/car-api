import { Controller, Get, Post, Req, Res, Body } from '@nestjs/common';

import { Request, Response } from 'express';

import { Public } from './public.decorator';

import { AuthService } from './auth.service';

import { SigninDTO } from '../../dtos/signin.dto';
import { SignupDTO } from '../../dtos/signup.dto';
import { AdminEntity } from '../../db/admin.entity';

@Controller('auth')
export class AuthController {
  constructor(protected readonly authService: AuthService) {}

  @Get('/')
  @Public()
  async auth(@Req() request: Request): Promise<AdminEntity> {
    const AUTH_KEY = (request.cookies.AUTH_KEY ||
      request.headers.authorization?.split(' ')[1]) as string;

    const user = await this.authService.auth(AUTH_KEY);
    user.AUTH_KEY = AUTH_KEY;

    return user;
  }

  @Post('/signin')
  @Public()
  async signin(@Body() authDTO: SigninDTO) {
    return await this.authService.signin(authDTO);
  }

  @Post('/signup')
  async signup(@Body() authDTO: SignupDTO) {
    return await this.authService.signup(authDTO);
  }

  @Get('/signout')
  @Public()
  signout(@Res({ passthrough: true }) response: Response) {
    response.cookie('AUTH_KEY', null);
  }
}
