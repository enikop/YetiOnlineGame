import express from 'express';
import cors from 'cors';
import { getRoutes } from "./routes";
import { AppDataSource } from "./data-source"
import { createServer } from "http";
import { SocketHandler } from './blue-yeti.socket';

async function main() {
  try {
    //DB connection
    await AppDataSource.initialize();

    const app = express();
    app.use(express.json());
    app.use(cors());
    app.use('/api', getRoutes());
    const httpServer = createServer(app);
    const handler = new SocketHandler(httpServer);

    httpServer.listen(3000, () => {
        console.log('Listening on port 3000 ...')
    });

  } catch (error) {
    console.log(error);
  }
}

 main();

