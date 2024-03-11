import { AppDataSource } from "../data-source";
import { Deck } from "../entity/Deck";
import { Controller } from "./base.controller";

export class DeckController extends Controller{
    repository = AppDataSource.getRepository(Deck)
}