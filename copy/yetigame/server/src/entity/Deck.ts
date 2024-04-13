import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm"
import { Card } from "./Card";


@Entity()
export class Deck {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 50 })
    level: string;

    @Column({ length: 50 })
    type: string;

    @OneToMany(() => Card, card => card.deck, {eager: true})
    cards: Card[];
}
