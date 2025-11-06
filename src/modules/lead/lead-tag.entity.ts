import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { LeadEntity } from './lead.entity';

@Entity('lead_tags')
export class LeadTagEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 7, default: '#4f8cff' })
  color: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToMany(() => LeadEntity, (lead) => lead.tags)
  @JoinTable({
    name: 'lead_tag_relations',
    joinColumn: { name: 'tagId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'leadId', referencedColumnName: 'id' },
  })
  leads: LeadEntity[];
}



