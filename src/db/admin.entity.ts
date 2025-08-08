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
