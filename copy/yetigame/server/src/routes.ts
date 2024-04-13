import { Router } from 'express';
import { CardController } from "./controller/card.controller";
import { DeckController } from './controller/deck.controller';
import { CardGroupController } from './controller/card-group.controller';


export function getRoutes() {
    const router = Router();

    const cardController = new CardController();
    const deckController = new DeckController();
    const cardGroupController = new CardGroupController();

    router.get('/quiz/:deckId/:count', cardController.getRandomCardsFromDeck);
    router.get('/allDecks', deckController.getAll);
    router.get('/deck/:id', deckController.getOne);
    router.get('/groupsFromDeck/:deckId',cardGroupController.getAllGroupsWithCards);
    
    return router;
}