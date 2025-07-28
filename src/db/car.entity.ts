import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Car {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  brand: string;

  @Column({ length: 50 })
  model: string;

  @Column({ type: 'smallint', unsigned: true })
  year: number;

  @Column({ type: 'int', unsigned: true })
  mileage: number;

  @Column({ type: 'varchar', length: 17, nullable: true })
  vin: string;

  @Column({ length: 20 })
  gearbox: string;

  @Column({ length: 20 })
  fuel: string;

  @Column({ type: 'int', unsigned: true })
  powerValue: number;

  @Column()
  powerType: string;

  @Column({ type: 'decimal', precision: 3, scale: 1 })
  engine: number;

  @Column()
  drive: string;

  @Column('simple-json', { nullable: true })
  deferredReload: string[];

  @Column({ type: 'int', unsigned: true })
  price: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column('simple-json', { nullable: true })
  images: string[];
}
