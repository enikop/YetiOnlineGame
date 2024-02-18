import express from 'express';
import { getRoutes } from "./routes";
import { AppDataSource } from "./data-source"
import { createServer } from "http";
import { Server } from "socket.io";
import cors from 'cors';


AppDataSource.initialize().then(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', getRoutes());
    app.use(cors);

    /*app.listen(3000, () => {
        console.log('Listening on port 3000 ...')
    });*/

    const httpServer = createServer(app);
    const io = new Server(httpServer, {
        cors: {
          origin: "http://localhost:4200",
          methods: ["GET", "POST"]
        }
    });

    io.on("connection", (socket) => {
       console.log(socket.id);
    });

    httpServer.listen(3000, () => {
        console.log('Listening on port 3000 ...')
    });

   /* console.log("Inserting a new user into the database...")
    const user = new User()
    user.firstName = "Timber"
    user.lastName = "Saw"
    user.age = 25
    await AppDataSource.manager.save(user)
    console.log("Saved a new user with id: " + user.id)*/

    //console.log("Loading users from the database...")
    //const decks = await AppDataSource.manager.find(Deck)
    //console.log("Loaded cards: ", decks[0].cards)

    //console.log("Here you can setup and run express / fastify / any other framework.")

}).catch(error => console.log(error))
