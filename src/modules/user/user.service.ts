import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';

export interface UserFingerprint {
  fingerprint: string;
  name?: string;
  email?: string;
  phone?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
  ) {}

  async createOrUpdateUser(fingerprintData: UserFingerprint): Promise<UserEntity> {
    console.log('UserService: Creating or updating user with fingerprint:', fingerprintData.fingerprint);
    
    try {
      // Ищем существующего пользователя
      let user = await this.userRepository.findOne({
        where: { fingerprint: fingerprintData.fingerprint }
      });

      if (user) {
        // Обновляем существующего пользователя
        user.name = fingerprintData.name || user.name;
        user.email = fingerprintData.email || user.email;
        user.phone = fingerprintData.phone || user.phone;
        user.ipAddress = fingerprintData.ipAddress || user.ipAddress;
        user.userAgent = fingerprintData.userAgent || user.userAgent;
        user.lastSeenAt = new Date();
        user.isActive = true;
        
        user = await this.userRepository.save(user);
        console.log('UserService: User updated:', user.id);
      } else {
        // Создаем нового пользователя
        user = this.userRepository.create({
          fingerprint: fingerprintData.fingerprint,
          name: fingerprintData.name,
          email: fingerprintData.email,
          phone: fingerprintData.phone,
          ipAddress: fingerprintData.ipAddress,
          userAgent: fingerprintData.userAgent,
          lastSeenAt: new Date(),
          isActive: true
        });
        
        user = await this.userRepository.save(user);
        console.log('UserService: New user created:', user.id);
      }

      return user;
    } catch (error) {
      console.error('UserService: Error creating/updating user:', error);
      throw error;
    }
  }

  async getUserByFingerprint(fingerprint: string): Promise<UserEntity | null> {
    return await this.userRepository.findOne({
      where: { fingerprint, isActive: true },
      relations: ['chatSessions']
    });
  }

  async getUserById(id: number): Promise<UserEntity | null> {
    return await this.userRepository.findOne({
      where: { id, isActive: true },
      relations: ['chatSessions']
    });
  }

  async updateUserLastSeen(fingerprint: string): Promise<void> {
    await this.userRepository.update(
      { fingerprint },
      { lastSeenAt: new Date() }
    );
  }

  async deactivateUser(fingerprint: string): Promise<void> {
    await this.userRepository.update(
      { fingerprint },
      { isActive: false }
    );
  }

  async getActiveUsers(): Promise<UserEntity[]> {
    return await this.userRepository.find({
      where: { isActive: true },
      order: { lastSeenAt: 'DESC' }
    });
  }
}
