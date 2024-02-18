import { AppDataSource } from "../data-source";
import { CardGroup} from "../entity/CardGroup";
import { Controller } from "./base.controller";

export class CardGroupController extends Controller{
    repository = AppDataSource.getRepository(CardGroup)
}