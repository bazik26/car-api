import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
} from 'typeorm';

@Entity()
export class Car {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({length: 50})
    brand: string;

    @Column({length: 50})
    model: string;

    @Column({type: 'smallint', unsigned: true})
    year: number;

    @Column({type: 'int', unsigned: true})
    mileage: number;

    @Column({type: 'varchar', length: 17, nullable: true})
    vin: string;

    @Column({length: 20})
    gearbox: string;

    @Column({length: 20})
    fuel: string;

    @Column({type: 'int', unsigned: true, nullable: true})
    powerValue: number;

    @Column({nullable: true})
    powerType: string;

    @Column({type: 'decimal', precision: 3, scale: 1,nullable: true})
    engine: number;

    @Column({nullable: true})
    drive: string;

    @Column({type: 'int', unsigned: true,nullable: true})
    price: number;

    @Column({type: 'text', nullable: true})
    description: string;

    @Column('simple-json', {nullable: true})
    images: string[];

    @Column({type: 'varchar', nullable: true})
    conditionerType: string;

    @Column({type: 'varchar', nullable: true})
    windowLifter: string;

    @Column({type: 'varchar', nullable: true})
    interiorMaterials: string;

    @Column({type: 'varchar', nullable: true})
    interiorColor: string;

    @Column({type: 'varchar', nullable: true})
    powerSteering: string;

    @Column({type: 'varchar', nullable: true})
    steeringWheelAdjustment: string;

    @Column({type: 'varchar', nullable: true})
    spareWheel: string;

    @Column({type: 'varchar', nullable: true})
    headlights: string;

    @Column({type: 'varchar', nullable: true})
    seatAdjustment: string;

    @Column({type: 'varchar', nullable: true})
    memorySeatModule: string;

    @Column({type: 'varchar', nullable: true})
    seatHeated: string;

    @Column({type: 'varchar', nullable: true})
    seatVentilation: string;

    @Column('simple-json', {nullable: true})
    group1: string[];

    @Column('simple-json', {nullable: true})
    group2: string[];

    @Column('simple-json', {nullable: true})
    group3: string[];

    @Column('simple-json', {nullable: true})
    group4: string[];

    @Column('simple-json', {nullable: true})
    group5: string[];

    @Column('simple-json', {nullable: true})
    group6: string[];

    @Column('simple-json', {nullable: true})
    group7: string[];

    @Column('simple-json', {nullable: true})
    group8: string[];

    @Column('simple-json', {nullable: true})
    group9: string[];

    @CreateDateColumn({nullable: true})
    public readonly createdAt!: Date;

    @UpdateDateColumn({nullable: true})
    public readonly updatedAt!: Date;

    @DeleteDateColumn({nullable: true})
    public readonly deletedAt!: Date;
}
