import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { Card } from "../entity/Card";
import { Controller } from "./base.controller";

export class CardController extends Controller{
    repository = AppDataSource.getRepository(Card);

    getRandomCardsFromDeck = async (req:Request, res:Response) => {
       try {
            const deckId = req.params.deckId;
            const count = parseInt(req.params.count);
            const cards = await this.repository
                .createQueryBuilder('card')
                .where('card.deck_id = :deckId', { deckId })
                .leftJoinAndSelect('card.cardGroup', 'cardGroup')
                .orderBy('RAND()')
                .take(count)
                .getMany();
            res.json(cards);
        } catch (err) {
            this.handleError(res, err);
        }
    };
}