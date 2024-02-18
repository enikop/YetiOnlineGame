export interface DeckDTO {
    id: number;
    level: string;
    type: string;
    cards: CardDTO[];
}
export interface CardGroupDTO {
    id: number;
    subtype: string;
    convergent: boolean;
    cards: CardDTO[];
}
export interface CardDTO {
    id: number;
    latex: string;
    simple: boolean;
    deck: DeckDTO;
    cardGroup: CardGroupDTO;
}