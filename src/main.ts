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
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:4202',
      'https://car-client-production.up.railway.app',
      'https://car-client-old-production.up.railway.app',
      'https://car-client-2-production.up.railway.app',
      'https://car-client-3-production.up.railway.app',
      'https://car-admin-production-7255.up.railway.app',
      'https://car-promo-1-production.up.railway.app',
      'https://adenatrans.ru',
      'https://www.adenatrans.ru',
      'https://vamauto.com',
      'https://www.vamauto.com',
      'https://prime-autos.ru',
      'https://www.prime-autos.ru',
      'https://auto-c-cars.ru',
      'https://www.auto-c-cars.ru',
      'https://shop-ytb-client.onrender.com',
      'https://autobroker-yar.ru',
      'https://www.autobroker-yar.ru',
      'https://putinxuylo.ru',
      'https://www.putinxuylo.ru'
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
      cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 24 часа
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());

  await app.listen(process.env.PORT ?? 3001);
}

bootstrap();
