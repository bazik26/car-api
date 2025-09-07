import { NestFactory, Reflector } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';

import * as cookieParser from 'cookie-parser';
import * as session from 'express-session';
import * as passport from 'passport';

import { AppModule } from './app.module';

import { AuthGuard } from './modules/auth/auth.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:4200',
      'https://car-client-production.up.railway.app',
      'https://car-client-old-production.up.railway.app',
      'http://localhost:3001',
      'http://localhost:3000',
      'http://localhost:3002',
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      validationError: {
        target: false,
      },
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },

      exceptionFactory: (errors) => new BadRequestException(errors),
    }),
  );

  app.useGlobalGuards(new AuthGuard(new Reflector()));

  app.use(cookieParser());
  app.use(
    session({
      secret: 'asiodasjoddjdoasddasoidjasiodasdjaiodd',
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 60000 },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());

  await app.listen(process.env.PORT ?? 3001);
}

bootstrap();
