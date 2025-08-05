import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
} from 'typeorm';

import { CarEntity } from './car.entity';

@Entity({
  name: 'files',
})
export class FileEntity {
  @PrimaryGeneratedColumn()
  readonly id: number;

  @Column()
  filename!: string;

  @Column()
  mimetype!: string;

  @Column()
  path!: string;

  @ManyToOne(() => CarEntity, (user) => user.files, {
    onDelete: 'CASCADE',
  })
  car: CarEntity;

  @CreateDateColumn()
  readonly createdAt!: Date;

  @UpdateDateColumn()
  readonly updatedAt!: Date;

  @DeleteDateColumn()
  readonly deletedAt!: Date;
}
