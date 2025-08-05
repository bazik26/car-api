import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AdminEntity } from './db/admin.entity';
import { CarEntity } from './db/car.entity';
import { FileEntity } from './db/file.entity';

import { AuthModule } from './modules/auth/auth.module';

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

    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
