import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Card } from './Card';
@Entity()
export class CardGroup {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    convergent: boolean;

    @Column({ length: 50, nullable: true })
    subtype: string;

    @OneToMany(() => Card, card => card.cardGroup)
    cards: Card[];
}