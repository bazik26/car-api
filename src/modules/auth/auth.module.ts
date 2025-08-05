import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller';

import { AuthService } from './auth.service';
import { AuthStrategy } from './auth.strategy';

import { AdminEntity } from '../../db/admin.entity';

@Module({
  controllers: [AuthController],
  providers: [AuthStrategy, AuthService],
  imports: [
    TypeOrmModule.forFeature([AdminEntity]),

    PassportModule.register({}),
    JwtModule.register({
      secret: '-u%R-fFo?SVG];tOkN%$7>MF^|;OEv^.-I-i/,KfE%6`Aaz{e>YCkP1EW@^]S8<',
      signOptions: { expiresIn: `192 minutes` },
    }),
  ],
  exports: [AuthStrategy, AuthService],
})
export class AuthModule {}
