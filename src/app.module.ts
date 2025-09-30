import { join } from 'path';

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';

import { AdminEntity } from './db/admin.entity';
import { CarEntity } from './db/car.entity';
import { FileEntity } from './db/file.entity';
import { AdminModule } from './modules/admin/admin.module';

import { AuthModule } from './modules/auth/auth.module';
import { CarModule } from './modules/car/car.module';

import { AppController } from './app.controller';
import { AppService } from './app.service';

const ENTITIES = [AdminEntity, CarEntity, FileEntity];

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.MYSQLHOST || 'localhost',
      port: Number(process.env.MYSQLPORT ?? 3306),
      database: process.env.MYSQLDATABASE || 'auto',
      username: process.env.MYSQLUSER || 'root',
      password: process.env.MYSQLPASSWORD || 'root',
      entities: ENTITIES,
      synchronize: true,
    }),

    TypeOrmModule.forFeature(ENTITIES),

    ServeStaticModule.forRoot({
      rootPath: process.env.UPLOAD_DIR || join(__dirname, '..', 'images'),
      serveRoot: '/',
    }),

    AdminModule,
    AuthModule,
    CarModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
