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

export enum ProjectType {
  OFFICE_1 = 'office_1',
  OFFICE_2 = 'office_2',
}

export interface AdminPermissions {
  canAddCars: boolean;
  canViewCars: boolean;
  canManageLeads: boolean; // включает редактирование
  canViewLeads: boolean; // только просмотр, без редактирования
}

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

  @Column({ type: 'enum', enum: ProjectType, nullable: true })
  projectId?: ProjectType;

  @Column({ type: 'json', nullable: true })
  permissions?: AdminPermissions;

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
