import { Router, Request, Response } from 'express';
import { CardController } from "./controller/card.controller";
import { DeckController } from './controller/deck.controller';


export function getRoutes() {
    const router = Router();

    const cardController = new CardController();
    const deckController = new DeckController();

    router.get('/quiz/:deckId/:count', cardController.getRandomCardsFromDeck);
    router.get('/allDecks', deckController.getAll);
    router.get('/deck/:id', deckController.getOne);
    
    return router;
}