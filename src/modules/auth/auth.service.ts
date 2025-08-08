import {
  ForbiddenException,
  Inject,
  Injectable,
  Scope,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';

import { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { SigninDTO } from '../../dtos/signin.dto';

import { AdminEntity } from '../../db/admin.entity';

@Injectable({ scope: Scope.REQUEST })
export class AuthService {
  constructor(
    @Inject(REQUEST)
    protected readonly request: Request,
    protected readonly jwtService: JwtService,
    @InjectRepository(AdminEntity)
    protected readonly adminRepo: Repository<AdminEntity>,
  ) {}

  async getUser({
    id,
    email,
  }: {
    id?: number;
    email?: string;
  }): Promise<AdminEntity | null> {
    return await this.adminRepo.findOne({
      where: [{ id }, { email }],
    });
  }

  async makeAuth(user: AdminEntity) {
    user.AUTH_KEY = this.jwtService.sign({ id: user.id });

    await this.auth(user.AUTH_KEY);

    return user;
  }

  async auth(AUTH_KEY: string): Promise<AdminEntity> {
    if (!AUTH_KEY) {
      throw new UnauthorizedException();
    }

    const { id }: { id: number } = this.jwtService.verify(AUTH_KEY);

    const user = await this.getUser({
      id,
    });

    if (user) {
      return user;
    }

    throw new UnauthorizedException();
  }

  async signin(
    authDTO: SigninDTO,
  ): Promise<{
    id: number;
  }> {
    const { email, password } = authDTO;

    const user = await this.getUser({
      email,
    });

    if (user) {
      if (user.deletedAt) {
        throw new ForbiddenException();
      }

      const isPasswordMatching = await bcrypt.compare(password, user.password);

      if (isPasswordMatching) {
        return await this.makeAuth(user);
      }
    }

    throw new UnauthorizedException();
  }
}
