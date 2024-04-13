import express from 'express';
import { Response } from "express";
import { getRoutes } from "./routes";
import { AppDataSource } from "./data-source"
import { createServer } from "http";
import { Server } from "socket.io";
import cors from 'cors';
import { CardGroupController } from './controller/card-group.controller';
import { CardGroup } from './entity/CardGroup';

interface SocketUser{
    socketId: string;
    playerId: string;
    userName: string;
    inGame: boolean;
    currentHand: CardExtended[];
}

interface Game {
    id: number;
    deckId: string;
    full: boolean;
    players: SocketUser[];
    gameState: GameState;
    result:string[];
}

interface CardExtended {
    id: number;
    latex: string;
    simple: boolean;
    groupId: number;
    subtype: string;
    convergent: boolean;
}
interface SimpleCard {
    id: string,
    latex: string
}
interface GameState{
    convLess: CardExtended;
    convGreater: CardExtended;
    divLess: CardExtended;
    divGreater: CardExtended;
}

interface PairingNotification{
    valid: boolean;
    convergent?: boolean;
    message?: string;
    less: SimpleCard;
    greater: SimpleCard;
}

AppDataSource.initialize().then(async () => {
    const MAX_PLAYER_NUMBER = 4;
    const  DECK_SIZE: number = 5;
    const app = express();
    app.use(express.json());
    app.use('/api', getRoutes());
    app.use(cors);

    const httpServer = createServer(app);
    const io = new Server(httpServer);

    const games: Game[] = [];
    io.on("connection", (socket) => {
        const deckId = socket.handshake.query.deckId as string;
        const userId = socket.handshake.query.userId as string;
        const socketUser : SocketUser = {playerId: userId, socketId: socket.id, userName: "Player"+userId,  inGame:true, currentHand: []};
        const gameId = handleJoin(deckId, socketUser);
        socket.join('room'+gameId);
        const game = games.filter(game=> game.id == gameId)[0];
        if(game.full){
            io.to('room'+gameId).emit('startGame', gameId);
            sendOutCards(game);
        }

        socket.on('draw', (drawData) => {
            const game = games.filter(game=> game.players.filter((player => player.socketId == socket.id)).length > 0)[0];
            const playerIndex = game.players.findIndex(player => player.socketId == socket.id);

            var nextPlayer = getNextPlayer(playerIndex, game);

            io.to(nextPlayer.socketId).emit('giveCard', drawData);
        })

        socket.on('give', (card) => {
            const game = games.filter(game=> game.players.filter((player => player.socketId == socket.id)).length > 0)[0];
            const playerIndex = game.players.findIndex(player => player.socketId == socket.id);
            const giver = game.players[playerIndex];
            const receiver = getPrecedentPlayer(playerIndex, game);
            const cardIndex = giver.currentHand.findIndex(playerCard => playerCard.id == card.id);
            const cardPassed = giver.currentHand[cardIndex];
            receiver.currentHand.push(cardPassed);
            io.to(receiver.socketId).emit('receivedCard', {id: cardPassed.id, latex:cardPassed.latex });
            giver.currentHand.splice(cardIndex, 1);
            io.to(giver.socketId).emit('pulledCard');
            if(giver.currentHand.length==0){
                giver.inGame = false;
                game.result.push(giver.playerId);
                io.to('room'+game.id).emit('playerOut', giver.playerId);
                const inGamePlayers = game.players.filter(p => p.inGame);
                if(inGamePlayers.length==1){
                    io.to('room'+game.id).emit('gameOver', {'result': game.result, 'loser':inGamePlayers[0].playerId})
                }
            }

            io.to('room'+game.id).emit('startPairPhase');
        })

        socket.on('endTurn', ()=>{
            const game = games.filter(game=> game.players.filter((player => player.socketId == socket.id)).length > 0)[0];
            const playerIndex = game.players.findIndex(player => player.socketId == socket.id);
            var nextDrawer = getNextPlayer(playerIndex, game);
            const nextIndex = game.players.findIndex(player => player.socketId == nextDrawer.socketId);
            var nextGiver = getNextPlayer(nextIndex, game);
            io.to('room'+game.id).emit('nextPlayer', {drawer: nextDrawer.playerId, drawFrom:nextGiver.playerId});
            game.gameState = {
                convLess: undefined,
                convGreater: undefined,
                divLess: undefined,
                divGreater: undefined
            }
        })
        //TODO: nextPlayer emit io.to('room'+game.id).emit('nextPlayer', {drawer: giver.playerId, drawFrom:nextGiver.playerId});

        socket.on('putDown', (putDownData) =>{
            const game = games.filter(game=> game.players.filter((player => player.socketId == socket.id)).length > 0)[0];
            const player = game.players.filter((player => player.socketId == socket.id))[0];
            const currentCard = player.currentHand.filter(c => c.id.toString() == putDownData.card.id)[0];
            placeCardInSpot(game, putDownData.cardPlacement, currentCard);
            io.to('room'+game.id).emit('placedCard', putDownData);
            const checkResult = checkPairs(game);
            if(checkResult.valid){
                const lessIndex = player.currentHand.indexOf(player.currentHand.filter(card => card.id.toString() == checkResult.less.id)[0]);
                player.currentHand.splice(lessIndex, 1);
                const greaterIndex = player.currentHand.indexOf(player.currentHand.filter(card => card.id.toString() == checkResult.greater.id)[0]);
                player.currentHand.splice(greaterIndex, 1);
            }
            if(player.currentHand.length == 0){
                player.inGame = false;
                game.result.push(player.playerId);
                io.to('room'+game.id).emit('playerOut', player.playerId);
                const inGamePlayers = game.players.filter(p => p.inGame);
                if(inGamePlayers.length==1){
                    io.to('room'+game.id).emit('gameOver', {'result': game.result, 'loser':inGamePlayers[0].playerId})
                }
            }
        })

        socket.on('moveAway', (moveData) =>{
            const game = games.filter(game=> game.players.filter((player => player.socketId == socket.id)).length > 0)[0];
            const player = game.players.filter((player => player.socketId == socket.id))[0];
            const currentCard = player.currentHand.filter(c => c.id.toString() == moveData.card.id)[0];
            placeCardInSpot(game, moveData.newPlacement, currentCard);
            deleteCardFromSpot(game, moveData.previousPlacement);
            io.to('room'+game.id).emit('movedCard', moveData);
            const checkResult = checkPairs(game);
            if(checkResult.valid){
                const lessIndex = player.currentHand.indexOf(player.currentHand.filter(card => card.id.toString() == checkResult.less.id)[0]);
                const greaterIndex = player.currentHand.indexOf(player.currentHand.filter(card => card.id.toString() == checkResult.greater.id)[0]);
                player.currentHand.splice(lessIndex, 1);
                player.currentHand.splice(greaterIndex, 1);
            }
            if(player.currentHand.length == 0){
                player.inGame = false;
                game.result.push(player.playerId);
                io.to('room'+game.id).emit('playerOut', player.playerId);
                const inGamePlayers = game.players.filter(p => p.inGame);
                if(inGamePlayers.length==1){
                    io.to('room'+game.id).emit('gameOver', {'result': game.result, 'loser':inGamePlayers[0].playerId})
                }
            }
        })

        socket.on('putBack', (putBackData) =>{
            const game = games.filter(game=> game.players.filter((player => player.socketId == socket.id)).length > 0)[0];
            deleteCardFromSpot(game, putBackData.cardPlacement);
            io.to('room'+game.id).emit('replacedCard', putBackData);
        })

        socket.on('disconnect', () => {
            console.log('A client disconnected:', socket.id);
            const game = games.filter(game=> game.players.filter((player => player.socketId == socket.id)).length > 0)[0];
            //if the game hasn't started yet, simply disconnect the player
            if(!game.full){
                var index = games.indexOf(game);
                game.players.splice(index, 1);
            }
            //if the game is already in progress
            //TODO: robot player?
          });
    });

    httpServer.listen(3000, () => {
        console.log('Listening on port 3000 ...')
    });

    function checkPairs(game: Game){
        const gameState = game.gameState;
        var res: PairingNotification = {valid:false, less:undefined, greater:undefined};
        if(gameState.divLess && gameState.divGreater){
            res = checkPair(gameState.divLess, gameState.divGreater, false)
            if(res.valid){
                gameState.divLess = undefined;
                gameState.divGreater = undefined;
            }
            io.to('room'+game.id).emit('pairFeedback', res);
        }
        else if(gameState.convLess && gameState.convGreater){
            res = checkPair(gameState.convLess, gameState.convGreater, true)
            if(res.valid){
                gameState.convLess = undefined;
                gameState.convGreater = undefined;
            }
            io.to('room'+game.id).emit('pairFeedback', res);
        }
        return res;
    }

    function checkPair(less: CardExtended, greater: CardExtended, convergent: boolean): PairingNotification{
        var output: PairingNotification = {
            valid: false,
            message: "Different convergence property.",
            less: {id: less.id.toString(), latex: less.latex},
            greater: {id: greater.id.toString(), latex: greater.latex}
        };
        if(less.convergent != greater.convergent) output.message = "Different convergence property.";
        if(less.groupId != greater.groupId || less.simple == greater.simple) output.message = "Not a valid pair.";
        else if(less.convergent != convergent) output.message = "Incorrect guess of convergence.";
        else if((convergent && less.simple) || (!convergent && greater.simple) )output.message = "Incorrect direction of estimation, members of the pair should be switched.";
        else output =  {
            valid: true,
            convergent: greater.convergent,
            less: {id: less.id.toString(), latex: less.latex},
            greater: {id: greater.id.toString(), latex: greater.latex}
        };
        return output;
    }

    function placeCardInSpot(game: Game, spotName:string, card: CardExtended){
        switch(spotName){
            case 'div-less-spot': {
                game.gameState.divLess = card;
                break;
            }
            case 'div-greater-spot': {
                game.gameState.divGreater = card;
                break;
            }
            case 'conv-less-spot': {
                game.gameState.convLess = card;
                break;
            }
            case 'conv-greater-spot': {
                game.gameState.convGreater = card;
                break;
            }
          }
    }

    function deleteCardFromSpot(game: Game, spotName:string){
        switch(spotName){
            case 'div-less-spot': {
                game.gameState.divLess = undefined;
                break;
            }
            case 'div-greater-spot': {
                game.gameState.divGreater = undefined;
                break;
            }
            case 'conv-less-spot': {
                game.gameState.convLess = undefined;
                break;
            }
            case 'conv-greater-spot': {
                game.gameState.convGreater = undefined;
                break;
            }
          }
    }

    function handleJoin(deckId: string, socketUser: SocketUser): number{
        const joinableGames = games.filter((game => !game.full && game.deckId == deckId));
        if(joinableGames.length == 0){
            return createNewGame(deckId, socketUser);
        }
        else{
            addPlayerToGame(joinableGames[0], socketUser);
            return joinableGames[0].id;
        }
    }

    function createNewGame(deckId:string, firstInGameSocketUser: SocketUser) : number{
        var newId: number;
        do {
            newId = generateRandomId();
        } while (!isIdUnique(newId));
        const newGame: Game = {
            id: newId,
            deckId: deckId,
            full: false,
            players: [firstInGameSocketUser],
            gameState: {
                convLess: undefined,
                convGreater: undefined,
                divLess: undefined,
                divGreater: undefined
            },
            result:[],
        }
        games.push(newGame);
        return newId;
    }

    function addPlayerToGame(gameToJoin: Game, socketUser: SocketUser){
        gameToJoin.players.push(socketUser);
        if(gameToJoin.players.length == MAX_PLAYER_NUMBER){
           gameToJoin.full = true;
        }
    }

    function generateRandomId(): number {
        return Math.floor(10000000 + Math.random() * 90000000);
    }

    // Function to check if the generated ID already exists
    function isIdUnique(newId: number): boolean {
        return !games.some(game => game.id === newId);
    }

    function sendOutCards(game: Game){
        var cardGroups: CardGroup[];
        const cardGroupController = new CardGroupController();
        const res = { json: (data: any) =>  { cardGroups = data as CardGroup[]; }} as Response;
        cardGroupController.callGetAllGroupsWithCards(game.deckId, res).then(
            ()=>{
                var currentDeck: CardExtended[] = createDeck(cardGroups);
                distributeDeckToPlayers(game, currentDeck);
                const simplifiedPlayers = simplifyPlayers(game.players);
                for (var i = 0; i < game.players.length; i++) {
                    //produce objects that will be passed to clients
                    const simplifiedHand = simplifyHand(game.players[i].currentHand);
                    io.to(game.players[i].socketId).emit("deckInit", JSON.stringify({ hand: simplifiedHand, players: simplifiedPlayers}));
                }
            }
        );
    }

    function simplifyPlayers(players: SocketUser[]){
        return players.map(item => {
            return {playerId: item.playerId, userName: item.userName, cardNumber: item.currentHand.length}
        });
    }
    function simplifyHand(currentHand: CardExtended[]){
        return currentHand.map(item => {
            return { id: item.id, latex: item.latex };
        });

    }

    function distributeDeckToPlayers(game: Game, currentDeck:CardExtended[]){
        var playerIndex = 3;
        for (var i = 0; i < currentDeck.length; i++) {
            game.players[playerIndex].currentHand.push(currentDeck[i]);
            playerIndex++;
            if (playerIndex >= game.players.length) playerIndex = 0;
        }
    }

    function createDeck(groups: CardGroup[]): CardExtended[]{
        var index = 0;
        var currentDeck:CardExtended[]=[{
            id: 0,
            latex: 'y',
            simple: true,
            groupId: 0,
            subtype: 'yeti',
            convergent: false }];
        while(currentDeck.length < DECK_SIZE){
          if(index >= groups.length) index = 0;
          var group = groups[index];
          //choose simple element
          var element: CardExtended = chooseRandomElement(group.cards.filter(card => card.simple));
          element.groupId = group.id;
          element.convergent = group.convergent;
          element.subtype = group.subtype;
          currentDeck.push(element);
          //choose complex element
          element = chooseRandomElement(group.cards.filter(card => !card.simple));
          element.groupId = group.id;
          element.convergent = group.convergent;
          element.subtype = group.subtype;
          currentDeck.push(element);
            index++;
        }
        return shuffle(currentDeck);
    }
    function chooseRandomElement(array: any[]): any | undefined {
        if (array.length === 0) {
            return undefined;
        }
        const randomIndex = Math.floor(Math.random() * array.length);
        return array[randomIndex];
    }
    function shuffle(array: any[]) {
        const shuffledArray = array.slice();
        for (let i = shuffledArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
        }
        return shuffledArray;
    };

    function getPrecedentPlayer(playerIndex: number, game: Game){
        var curPlayerIndex = playerIndex;
        var previousPlayer: SocketUser;
        do{
            var prevPlayerIndex = curPlayerIndex - 1;
            if (prevPlayerIndex < 0) {
                prevPlayerIndex = game.players.length - 1;
            }
            previousPlayer = game.players[prevPlayerIndex];
            curPlayerIndex = prevPlayerIndex;
        } while(!previousPlayer.inGame);
        return previousPlayer;
    }

    function getNextPlayer(playerIndex: number, game: Game){
        var curPlayerIndex = playerIndex;
        var nextPlayer: SocketUser;
        do{
            var nextPlayerIndex = curPlayerIndex + 1;
            if(nextPlayerIndex >= game.players.length){
                nextPlayerIndex = 0;
            }
            nextPlayer = game.players[nextPlayerIndex];
            curPlayerIndex = nextPlayerIndex;
        } while(!nextPlayer.inGame);
        return nextPlayer;
    }


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

