import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Deck } from './Deck';
import { CardGroup } from './CardGroup';

@Entity()
export class Card {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 512 })
    latex: string;

    @Column()
    simple: boolean;

    @ManyToOne(() => Deck, deck => deck.cards)
    @JoinColumn({name: 'deck_id'})
    deck: Deck;

    @ManyToOne(() => CardGroup, cardGroup => cardGroup.cards, {eager: true})
    @JoinColumn({name: 'group_id'})
    cardGroup: CardGroup;
}