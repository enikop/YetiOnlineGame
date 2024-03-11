import "reflect-metadata"
import { DataSource } from "typeorm"
import { User } from "./entity/User"
import { Deck } from "./entity/Deck"
import { CardGroup } from "./entity/CardGroup"
import { Card } from "./entity/Card"

export const AppDataSource = new DataSource({
    
    type: "mysql",
    host: "localhost",
    port: 3306,
    username: "root",
    database: "yeti_game_db",
    synchronize: true,
    logging: false,
    entities: [User, Deck, CardGroup, Card],
    migrations: [],
    subscribers: [],
})
