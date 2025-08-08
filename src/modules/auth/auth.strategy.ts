import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthService } from './auth.service';

import { AdminEntity } from '../../db/admin.entity';

@Injectable()
export class AuthStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(protected readonly moduleRef: ModuleRef) {
    super({
      passReqToCallback: true,
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request): string | null => {
          const cookieToken =
            (request.cookies?.AUTH_KEY as string | undefined) ?? null;

          const headerToken = request.headers.authorization
            ? request.headers.authorization
            : null;

          return cookieToken || headerToken;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey:
        '-u%R-fFo?SVG];tOkN%$7>MF^|;OEv^.-I-i/,KfE%6`Aaz{e>YCkP1EW@^]S8<',
    });
  }

  async validate(
    request: Request & { user: AdminEntity },
    { id }: { id: number },
  ) {
    const contextId = ContextIdFactory.getByRequest(request);
    const authService = await this.moduleRef.resolve(AuthService, contextId);

    const user = await authService.getUser({ id });

    if (!user) {
      throw new UnauthorizedException();
    }

    request.user = user;

    return request.user;
  }
}
