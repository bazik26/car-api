import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { AdminEntity } from './admin.entity';

import { FileEntity } from './file.entity';

@Entity({
  name: 'cars',
})
export class CarEntity {
  @PrimaryGeneratedColumn()
  readonly id: number;

  @Column({ nullable: true })
  brand: string;

  @Column({ nullable: true })
  model: string;

  @Column({ type: 'smallint', unsigned: true, nullable: true })
  year: number;

  @Column({ type: 'int', unsigned: true, nullable: true })
  mileage: number;

  @Column({ nullable: true })
  vin: string;

  @Column({ nullable: true })
  gearbox: string;

  @Column({ nullable: true })
  fuel: string;

  @Column({ type: 'int', unsigned: true, nullable: true })
  powerValue: number;

  @Column({ nullable: true })
  powerType: string;

  @Column({ type: 'decimal', precision: 3, scale: 1, nullable: true })
  engine: number;

  @Column({ nullable: true })
  drive: string;

  @Column({ type: 'int', unsigned: true, nullable: true })
  price: number;

  @Column({ type: 'boolean', default: false })
  sale: boolean;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  conditionerType: string;

  @Column({ nullable: true })
  windowLifter: string;

  @Column({ nullable: true })
  interiorMaterials: string;

  @Column({ nullable: true })
  interiorColor: string;

  @Column({ nullable: true })
  powerSteering: string;

  @Column({ nullable: true })
  steeringWheelAdjustment: string;

  @Column({ nullable: true })
  spareWheel: string;

  @Column({ nullable: true })
  headlights: string;

  @Column({ nullable: true })
  seatAdjustment: string;

  @Column({ nullable: true })
  memorySeatModule: string;

  @Column({ nullable: true })
  seatHeated: string;

  @Column({ nullable: true })
  seatVentilation: string;

  @Column('simple-json', { nullable: true })
  group1: string[];

  @Column('simple-json', { nullable: true })
  group2: string[];

  @Column('simple-json', { nullable: true })
  group3: string[];

  @Column('simple-json', { nullable: true })
  group4: string[];

  @Column('simple-json', { nullable: true })
  group5: string[];

  @Column('simple-json', { nullable: true })
  group6: string[];

  @Column('simple-json', { nullable: true })
  group7: string[];

  @Column('simple-json', { nullable: true })
  group8: string[];

  @Column('simple-json', { nullable: true })
  group9: string[];

  @CreateDateColumn({ nullable: true })
  readonly createdAt!: Date;

  @UpdateDateColumn({ nullable: true })
  readonly updatedAt!: Date;

  @DeleteDateColumn({ nullable: true })
  readonly deletedAt!: Date;

  @OneToMany(() => FileEntity, (entity) => entity.car)
  readonly files!: FileEntity[];

  @ManyToOne(() => AdminEntity, (entity) => entity.cars, {
    eager: true,
  })
  admin!: AdminEntity;
}
