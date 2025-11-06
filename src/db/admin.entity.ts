import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';

import { CarEntity } from './car.entity';
import { ProjectType, AdminPermissions } from './project-type';

@Entity({
  name: 'admins',
})
export class AdminEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column({ type: 'boolean', default: false })
  isSuper!: boolean;

  @Column({ type: 'enum', enum: ProjectType, nullable: true, default: ProjectType.OFFICE_1 })
  projectId?: ProjectType;

  @Column({ type: 'json', nullable: true })
  permissions?: AdminPermissions;

  @Column({ type: 'json', nullable: true })
  workingDays?: Array<{
    day: number; // 0-6 (воскресенье-суббота)
    startTime: string; // "09:00"
    endTime: string; // "18:00"
    enabled: boolean;
  }>;

  @CreateDateColumn()
  readonly createdAt!: Date;

  @UpdateDateColumn()
  readonly updatedAt!: Date;

  @DeleteDateColumn()
  readonly deletedAt!: Date;

  @OneToMany(() => CarEntity, (entity) => entity.admin)
  readonly cars!: CarEntity[];

  AUTH_KEY!: string;
}
