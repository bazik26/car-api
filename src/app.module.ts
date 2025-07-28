import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Car } from './db/car.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'root',
      database: 'auto',
      entities: [Car],
      synchronize: true,
    }),

    TypeOrmModule.forFeature([Car]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
