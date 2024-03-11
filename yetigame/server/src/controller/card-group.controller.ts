import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { CardGroup} from "../entity/CardGroup";
import { Controller } from "./base.controller";

export class CardGroupController extends Controller {
    repository = AppDataSource.getRepository(CardGroup)

    getAllGroupsWithCards = async (req: Request, res: Response) => {
        try {
            const deckId = req.params.deckId;
            const groups = await this.repository
                .createQueryBuilder('group')
                .leftJoinAndSelect('group.cards', 'card')
                .where('card.deck = :deckId', { deckId })
                .getMany();
            res.json(groups);
        } catch (err) {
            this.handleError(res, err);
        }
    };

    callGetAllGroupsWithCards = async (deckId: string, res: Response) => {
        const mockReq = { params: { deckId } } as Request<any, any, any>;
        await this.getAllGroupsWithCards(mockReq, res);
    }


}