import { Response } from "express";
import { Server, ServerOptions } from "socket.io";
import { CardGroupController } from './controller/card-group.controller';
import { CardGroup } from './entity/CardGroup';
import { ClientSocketMessage, DRAW_TIME, EndGameUserData, PAIR_TIME, ServerSocketMessage } from '../../models';
import { Game, SocketUser, PairingNotification, CardExtended } from '../../models';
import { IncomingMessage, ServerResponse } from "http";
import { Server as HttpServer } from "http";

export class SocketHandler {

    private io: Server;
    private MAX_PLAYER_NUMBER = 4;
    private DECK_SIZE: number = 6;
    private games: Game[] = [];

    constructor(httpServer: HttpServer<typeof IncomingMessage, typeof ServerResponse> | Partial<ServerOptions>) {
        this.io = new Server(httpServer);
        this.setUp();
    }

    setUp() {
        this.io.on("connection", (socket) => {
            const deckId = socket.handshake.query.deckId as string;
            const userId = socket.handshake.query.userId as string;
            const socketUser: SocketUser = {
                playerId: userId,
                socketId: socket.id,
                userName: "Player" + userId,
                inGame: true,
                leftGame: false,
                currentHand: [],
                mistakeNum: 0
            };
            const gameId = this.handleJoin(deckId, socketUser);
            socket.join('room' + gameId);
            const game = this.games.filter(game => game.id == gameId)[0];
            if (game.full) {
                this.io.to('room' + gameId).emit(ServerSocketMessage.StartGame, gameId);
                this.sendOutCards(game);
                this.setDrawingTimer(game, game.players[0], game.players[1]);
            }

            socket.on(ClientSocketMessage.ChooseCard, (drawData) => {
                const game = this.getGameBySocketId(socket.id);
                game.resetDrawingTimer = true;
                const playerIndex = game.players.findIndex(player => player.socketId == socket.id);
                var nextPlayer = this.getNextPlayer(playerIndex, game);
                if (nextPlayer.leftGame) {
                    var index = Math.floor(Math.random() * nextPlayer.currentHand.length);
                    var card = nextPlayer.currentHand[index];
                    this.transferCard(nextPlayer.socketId, { id: card.id, latex: card.latex, subtype: card.subtype })
                } else {
                    this.io.to(nextPlayer.socketId).emit(ServerSocketMessage.PreviewCardDraw, drawData);
                }
            })

            socket.on(ClientSocketMessage.SendCard, (card) => {
                this.transferCard(socket.id, card);
            })

            socket.on(ClientSocketMessage.EndTurn, () => {
                this.endTurn(socket.id);
            })
            //TODO: nextPlayer emit this.io.to('room'+game.id).emit('nextPlayer', {drawer: giver.playerId, drawFrom:nextGiver.playerId});

            socket.on(ClientSocketMessage.PutDown, (putDownData) => {
                const game = this.getGameBySocketId(socket.id);
                const player = game.players.filter((player => player.socketId == socket.id))[0];
                const currentCard = player.currentHand.filter(c => c.id.toString() == putDownData.card.id)[0];
                this.placeCardInSpot(game, putDownData.cardPlacement, currentCard);
                this.io.to('room' + game.id).emit(ServerSocketMessage.PutDown, putDownData);
                this.handlePairs(game, player);
                this.checkForWin(player, game);
            })

            socket.on(ClientSocketMessage.PutDownMove, (moveData) => {
                const game = this.getGameBySocketId(socket.id);
                const player = game.players.filter((player => player.socketId == socket.id))[0];
                const currentCard = player.currentHand.filter(c => c.id.toString() == moveData.card.id)[0];
                this.placeCardInSpot(game, moveData.newPlacement, currentCard);
                this.deleteCardFromSpot(game, moveData.previousPlacement);
                this.io.to('room' + game.id).emit(ServerSocketMessage.PutDownMove, moveData);
                this.handlePairs(game, player);
                this.checkForWin(player, game);
            })

            socket.on(ClientSocketMessage.PickUp, (putBackData) => {
                const game = this.getGameBySocketId(socket.id);
                this.deleteCardFromSpot(game, putBackData.cardPlacement);
                this.io.to('room' + game.id).emit(ServerSocketMessage.PickUp, putBackData);
            })

            socket.on(ClientSocketMessage.PairNumberInquiry, () => {
                const game = this.getGameBySocketId(socket.id);
                const player = game.players.filter((player => player.socketId == socket.id))[0];
                const hand = player.currentHand;
                this.io.to(socket.id).emit(ServerSocketMessage.PairNumberAnswer, this.countPairs(hand));
            })

            socket.on('disconnect', () => {
                console.log('A client disconnected:', socket.id);
                const game = this.getGameBySocketId(socket.id);
                //if the game hasn't started yet, simply disconnect the player
                if (game && !game.full) {
                    var index = this.games.indexOf(game);
                    game.players.splice(index, 1);
                } else if (game) {
                    const player = game.players.filter((player => player.socketId == socket.id))[0];
                    player.leftGame = true;
                    const activePlayers = game.players.filter((player => !player.leftGame && player.inGame));
                    if (activePlayers.length == 0) {
                        this.io.to('room' + game.id).emit(ServerSocketMessage.EndGame, { 'result': game.result, 'complete': true });
                        //If no more active players are there, delete the game
                        this.games = this.games.filter(g => g.id != game.id);
                    } else {
                        this.io.to('room' + game.id).emit(ServerSocketMessage.EndGame, { 'result': game.result, 'complete': false });
                    }
                    //TODO let server do pairing as a robot player (now robot player only pulls and gives cards)
                }
            });
        });
    }

    private transferCard(giverSocketId: string, card: any) {
        const game = this.getGameBySocketId(giverSocketId);
        const playerIndex = game.players.findIndex(player => player.socketId == giverSocketId);
        const giver = game.players[playerIndex];
        const receiver = this.getPrecedentPlayer(playerIndex, game);
        const cardIndex = giver.currentHand.findIndex(playerCard => playerCard.id == card.id);
        const cardPassed = giver.currentHand[cardIndex];
        receiver.currentHand.push(cardPassed);
        this.io.to(receiver.socketId).emit(ServerSocketMessage.SendCard, { id: cardPassed.id, latex: cardPassed.latex, subtype: cardPassed.subtype });
        giver.currentHand.splice(cardIndex, 1);
        this.io.to(giver.socketId).emit(ServerSocketMessage.DrawCard);
        this.checkForWin(giver, game);

        this.io.to('room' + game.id).emit(ServerSocketMessage.StartPairing);
        this.setPairingTimer(game, receiver);
    }

    private handlePairs(game: Game, player: SocketUser) {
        const checkResult = this.checkPairs(game);
        if (checkResult.valid) {
            const lessIndex = player.currentHand.indexOf(player.currentHand.filter(card => card.id.toString() == checkResult.less.id)[0]);
            player.currentHand.splice(lessIndex, 1);
            const greaterIndex = player.currentHand.indexOf(player.currentHand.filter(card => card.id.toString() == checkResult.greater.id)[0]);
            player.currentHand.splice(greaterIndex, 1);
        } else if (checkResult.greater && checkResult.less) { //else if one of the pairing spaces is full
            player.mistakeNum++;
        }
    }

    private checkForWin(playerToCheck: SocketUser, game: Game) {
        if (playerToCheck.currentHand.length == 0) {
            playerToCheck.inGame = false;
            game.result.push({ playerId: playerToCheck.playerId, userName: playerToCheck.userName, mistakeNum: playerToCheck.mistakeNum, leftGame: playerToCheck.leftGame });
            this.io.to('room' + game.id).emit(ServerSocketMessage.PlayerOut, playerToCheck.playerId);
            const activePlayers = game.players.filter((player => !player.leftGame && player.inGame));
            const inGamePlayers = game.players.filter(player => player.inGame);
            if (inGamePlayers.length == 1 || activePlayers.length < 1) {
                game.resetDrawingTimer = true;
                game.resetPairingTimer = true;
                game.isPairingTimerRunning = true;
                game.isDrawingTimerRunning = true;
                const loser: EndGameUserData = {
                    playerId: inGamePlayers[0].playerId,
                    userName: inGamePlayers[0].userName,
                    mistakeNum: inGamePlayers[0].mistakeNum,
                    leftGame: inGamePlayers[0].leftGame,
                }
                this.io.to('room' + game.id).emit(ServerSocketMessage.EndGame, { 'result': game.result, 'loser': loser, 'complete': true });
            }
        }
    }

    private getGameBySocketId(socketId: string) {
        return this.games.filter(game => game.players.filter((player => player.socketId == socketId)).length > 0)[0];
    }

    private endTurn(socketId: string) {
        const game = this.games.filter(game => game.players.filter((player => player.socketId == socketId)).length > 0)[0];
        if (game) {
            game.resetPairingTimer = true;
            const playerIndex = game.players.findIndex(player => player.socketId == socketId);
            var nextDrawer = this.getNextPlayer(playerIndex, game);
            const nextIndex = game.players.findIndex(player => player.socketId == nextDrawer.socketId);
            var nextGiver = this.getNextPlayer(nextIndex, game);
            this.io.to('room' + game.id).emit(ServerSocketMessage.StartTurn, { drawer: nextDrawer.playerId, drawFrom: nextGiver.playerId });
            this.setDrawingTimer(game, nextDrawer, nextGiver);

            game.gameState = {
                convLess: undefined,
                convGreater: undefined,
                divLess: undefined,
                divGreater: undefined
            };
        }
    }

    setPairingTimer(game: Game, player: SocketUser) {
        if (!game.isPairingTimerRunning) {
            game.isPairingTimerRunning = true;
            game.timer = player.leftGame ? 1 : PAIR_TIME;
            var interval = setInterval(() => {
                this.io.to('room' + game.id).emit(ServerSocketMessage.TimerState, game.timer);
                if (game.resetPairingTimer) {
                    game.resetPairingTimer = false;
                    game.isPairingTimerRunning = false;
                    clearInterval(interval);
                } else if (--game.timer < 0) {
                    if (player.leftGame) {
                        this.doAutoPairing(game, player);
                        this.checkForWin(player, game);
                    }
                    this.endTurn(player.socketId);
                    game.isPairingTimerRunning = false;
                    clearInterval(interval);
                }
            }, 1000);
        }
    }

    //make one pairing if possible
    doAutoPairing(game: Game, player: SocketUser) {
        //Find the first pair
        var pair = { card1: undefined, card2: undefined }
        for (let card1 of player.currentHand) {
            for (let card2 of player.currentHand) {
                if (this.checkIfPairable(card1, card2)) {
                    pair.card1 = card1;
                    pair.card2 = card2;
                    break;
                }
            }
            if (pair.card1) break;
        }
        //If there is a pair, do the pairing
        if (pair.card1) {
            var res = { valid: true, less: undefined, greater: undefined };
            if (pair.card1.convergent) {
                res.less = pair.card1.simple ? pair.card2 : pair.card1;
                res.greater = pair.card1.simple ? pair.card1 : pair.card2;
                this.io.to('room' + game.id).emit(ServerSocketMessage.PutDown, { userId: player.playerId, card: res.less, cardPlacement: 'conv-less-spot' });
                this.io.to('room' + game.id).emit(ServerSocketMessage.PutDown, { userId: player.playerId, card: res.greater, cardPlacement: 'conv-greater-spot' });
            } else {
                res.less = pair.card1.simple ? pair.card1 : pair.card2;
                res.greater = pair.card1.simple ? pair.card2 : pair.card1;
                this.io.to('room' + game.id).emit(ServerSocketMessage.PutDown, { userId: player.playerId, card: res.less, cardPlacement: 'div-less-spot' });
                this.io.to('room' + game.id).emit(ServerSocketMessage.PutDown, { userId: player.playerId, card: res.greater, cardPlacement: 'div-greater-spot' });
            }
            this.io.to('room' + game.id).emit(ServerSocketMessage.PairFeedback, {
                valid: true,
                convergent: res.less.convergent,
                less: res.less,
                greater: res.greater
            });
            const lessIndex = player.currentHand.indexOf(player.currentHand.filter(card => card.id.toString() == res.less.id)[0]);
            player.currentHand.splice(lessIndex, 1);
            const greaterIndex = player.currentHand.indexOf(player.currentHand.filter(card => card.id.toString() == res.greater.id)[0]);
            player.currentHand.splice(greaterIndex, 1);
        }
    }

    setDrawingTimer(game: Game, currentPlayer: SocketUser, nextPlayer: SocketUser) {
        if (!game.isDrawingTimerRunning) {
            game.isDrawingTimerRunning = true;
            game.timer = currentPlayer.leftGame ? 1 : DRAW_TIME;
            var interval = setInterval(() => {
                this.io.to('room' + game.id).emit(ServerSocketMessage.TimerState, game.timer);
                if (game.resetDrawingTimer) {
                    game.resetDrawingTimer = false;
                    game.resetPairingTimer = false;
                    game.isDrawingTimerRunning = false;
                    clearInterval(interval);
                } else if (--game.timer < 0) {
                    const index = Math.floor(Math.random() * nextPlayer.currentHand.length);
                    if (nextPlayer.leftGame) {
                        var card = nextPlayer.currentHand[index];
                        this.transferCard(nextPlayer.socketId, { id: card.id, latex: card.latex, subtype: card.subtype });
                    } else {
                        this.io.to(nextPlayer.socketId).emit(ServerSocketMessage.PreviewCardDraw, { userId: currentPlayer, cardIndex: index });
                    }
                    game.resetPairingTimer = false;
                    game.isDrawingTimerRunning = false;
                    clearInterval(interval);
                }
            }, 1000);
        }
    }

    countPairs(hand: CardExtended[]) {
        var count = 0;
        hand.forEach((card1) => {
            hand.forEach((card2) => {
                if (this.checkIfPairable(card1, card2)) {
                    count++;
                }
            })
        });
        return count / 2;
    }

    checkPairs(game: Game) {
        const gameState = game.gameState;
        var res: PairingNotification = { valid: false, less: undefined, greater: undefined };
        if (gameState.divLess && gameState.divGreater) {
            res = this.checkPair(gameState.divLess, gameState.divGreater, false)
            if (res.valid) {
                gameState.divLess = undefined;
                gameState.divGreater = undefined;
            }
            this.io.to('room' + game.id).emit(ServerSocketMessage.PairFeedback, res);
        }
        else if (gameState.convLess && gameState.convGreater) {
            res = this.checkPair(gameState.convLess, gameState.convGreater, true)
            if (res.valid) {
                gameState.convLess = undefined;
                gameState.convGreater = undefined;
            }
            this.io.to('room' + game.id).emit(ServerSocketMessage.PairFeedback, res);
        }
        return res;
    }

    checkIfPairable(card1: CardExtended, card2: CardExtended): boolean {
        var valid = true;
        if (card1.groupId != card2.groupId || card1.simple == card2.simple) valid = false;
        return valid;
    }

    checkPair(less: CardExtended, greater: CardExtended, convergent: boolean): PairingNotification {
        var output: PairingNotification = {
            valid: false,
            message: "Different convergence property.",
            less: { id: less.id.toString(), latex: less.latex, subtype: less.subtype },
            greater: { id: greater.id.toString(), latex: greater.latex, subtype: greater.subtype }
        };
        if (less.convergent != greater.convergent) output.message = "Different convergence property.";
        if (less.groupId != greater.groupId || less.simple == greater.simple) output.message = "Not a valid pair.";
        else if (less.convergent != convergent) output.message = "Incorrect guess of convergence.";
        else if ((convergent && less.simple) || (!convergent && greater.simple)) output.message = "Incorrect direction of estimation, members of the pair should be switched.";
        else output = {
            valid: true,
            convergent: greater.convergent,
            less: { id: less.id.toString(), latex: less.latex, subtype: less.subtype },
            greater: { id: greater.id.toString(), latex: greater.latex, subtype: greater.subtype }
        };
        return output;
    }

    placeCardInSpot(game: Game, spotName: string, card: CardExtended) {
        switch (spotName) {
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

    deleteCardFromSpot(game: Game, spotName: string) {
        switch (spotName) {
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

    handleJoin(deckId: string, socketUser: SocketUser): number {
        const joinableGames = this.games.filter((game => !game.full && game.deckId == deckId));
        if (joinableGames.length == 0) {
            return this.createNewGame(deckId, socketUser);
        }
        else {
            this.addPlayerToGame(joinableGames[0], socketUser);
            return joinableGames[0].id;
        }
    }

    createNewGame(deckId: string, firstInGameSocketUser: SocketUser): number {
        var newId: number;
        do {
            newId = this.generateRandomId();
        } while (!this.isIdUnique(newId));
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
            result: [],
            timer: DRAW_TIME,
            resetDrawingTimer: false,
            resetPairingTimer: false,
            isDrawingTimerRunning: false,
            isPairingTimerRunning: false
        }
        this.games.push(newGame);
        return newId;
    }

    addPlayerToGame(gameToJoin: Game, socketUser: SocketUser) {
        gameToJoin.players.push(socketUser);
        if (gameToJoin.players.length == this.MAX_PLAYER_NUMBER) {
            gameToJoin.full = true;
        }
    }

    generateRandomId(): number {
        return Math.floor(10000000 + Math.random() * 90000000);
    }

    // Function to check if the generated ID already exists
    isIdUnique(newId: number): boolean {
        return !this.games.some(game => game.id === newId);
    }

    sendOutCards(game: Game) {
        var cardGroups: CardGroup[];
        const cardGroupController = new CardGroupController();
        const res = { json: (data: any) => { cardGroups = data as CardGroup[]; } } as Response;
        cardGroupController.callGetAllGroupsWithCards(game.deckId, res).then(
            () => {
                var currentDeck: CardExtended[] = this.createDeck(cardGroups);
                this.distributeDeckToPlayers(game, currentDeck);
                const simplifiedPlayers = this.simplifyPlayers(game.players);
                for (var i = 0; i < game.players.length; i++) {
                    //produce objects that will be passed to clients
                    const simplifiedHand = this.simplifyHand(game.players[i].currentHand);
                    this.io.to(game.players[i].socketId).emit(ServerSocketMessage.InitHand, JSON.stringify({ hand: simplifiedHand, players: simplifiedPlayers }));
                }
            }
        );
    }

    simplifyPlayers(players: SocketUser[]) {
        return players.map(item => {
            return { playerId: item.playerId, userName: item.userName, cardNumber: item.currentHand.length }
        });
    }
    simplifyHand(currentHand: CardExtended[]) {
        return currentHand.map(item => {
            return { id: item.id, latex: item.latex, subtype: item.subtype };
        });

    }

    distributeDeckToPlayers(game: Game, currentDeck: CardExtended[]) {
        var playerIndex = 3;
        for (var i = 0; i < currentDeck.length; i++) {
            game.players[playerIndex].currentHand.push(currentDeck[i]);
            playerIndex++;
            if (playerIndex >= game.players.length) playerIndex = 0;
        }
    }

    createDeck(groups: CardGroup[]): CardExtended[] {
        var index = 0;
        var currentDeck: CardExtended[] = [{
            id: 0,
            latex: 'y',
            simple: true,
            groupId: 0,
            subtype: 'yeti',
            convergent: false
        }];
        const allCards = groups.flatMap(group => group.cards);
        if (this.DECK_SIZE == allCards.length) {
            groups.forEach((group) => {
                group.cards.forEach((card) => {
                    currentDeck.push({
                        ...card,
                        groupId: group.id,
                        convergent: group.convergent,
                        subtype: group.subtype
                    });
                })
            });

            return this.shuffle(currentDeck);
        }
        while (currentDeck.length < this.DECK_SIZE) {
            if (index >= groups.length) index = 0;
            var group = groups[index];
            //choose simple element
            var element: CardExtended = this.chooseRandomElement(group.cards.filter(card => card.simple));
            element.groupId = group.id;
            element.convergent = group.convergent;
            element.subtype = group.subtype;
            currentDeck.push(element);
            //choose complex element
            element = this.chooseRandomElement(group.cards.filter(card => !card.simple));
            element.groupId = group.id;
            element.convergent = group.convergent;
            element.subtype = group.subtype;
            currentDeck.push(element);
            index++;
        }
        return this.shuffle(currentDeck);
    }
    chooseRandomElement(array: any[]): any | undefined {
        if (array.length === 0) {
            return undefined;
        }
        const randomIndex = Math.floor(Math.random() * array.length);
        return array[randomIndex];
    }
    shuffle(array: any[]) {
        const shuffledArray = array.slice();
        for (let i = shuffledArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
        }
        return shuffledArray;
    };

    getPrecedentPlayer(playerIndex: number, game: Game) {
        var curPlayerIndex = playerIndex;
        var previousPlayer: SocketUser;
        do {
            var prevPlayerIndex = curPlayerIndex - 1;
            if (prevPlayerIndex < 0) {
                prevPlayerIndex = game.players.length - 1;
            }
            previousPlayer = game.players[prevPlayerIndex];
            curPlayerIndex = prevPlayerIndex;
        } while (!previousPlayer.inGame);
        return previousPlayer;
    }

    getNextPlayer(playerIndex: number, game: Game) {
        var curPlayerIndex = playerIndex;
        var nextPlayer: SocketUser;
        do {
            var nextPlayerIndex = curPlayerIndex + 1;
            if (nextPlayerIndex >= game.players.length) {
                nextPlayerIndex = 0;
            }
            nextPlayer = game.players[nextPlayerIndex];
            curPlayerIndex = nextPlayerIndex;
        } while (!nextPlayer.inGame);
        return nextPlayer;
    }
}
