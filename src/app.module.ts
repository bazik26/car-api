import { join } from 'path';

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';

import { AdminEntity } from './db/admin.entity';
import { CarEntity } from './db/car.entity';
import { FileEntity } from './db/file.entity';

import { AuthModule } from './modules/auth/auth.module';
import { CarModule } from './modules/car/car.module';

const ENTITIES = [AdminEntity, CarEntity, FileEntity];

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'root',
      database: 'auto',
      entities: ENTITIES,
      synchronize: true,
    }),

    TypeOrmModule.forFeature(ENTITIES),

    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'images'),
      serveRoot: '/images',
    }),

    AuthModule,
    CarModule,
  ],
})
export class AppModule {}
