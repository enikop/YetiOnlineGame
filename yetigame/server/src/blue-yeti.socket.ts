import { Response } from "express";
import { Server, ServerOptions } from "socket.io";
import { CardGroupController } from './controller/card-group.controller';
import { CardGroup } from './entity/CardGroup';
import { ClientSocketMessage, ServerSocketMessage } from '../../models';
import { Game, SocketUser, PairingNotification, CardExtended } from '../../models';
import { IncomingMessage, ServerResponse } from "http";
import { Server as HttpServer } from "http";

export class SocketHandler {

  private io: Server;
  private MAX_PLAYER_NUMBER = 4;
  private DECK_SIZE: number = 5;
  private games: Game[] = [];

  constructor(httpServer: HttpServer<typeof IncomingMessage, typeof ServerResponse> | Partial<ServerOptions>) {
    this.io = new Server(httpServer);
    this.setUp();
  }

  setUp() {
    this.io.on("connection", (socket) => {
      const deckId = socket.handshake.query.deckId as string;
      const userId = socket.handshake.query.userId as string;
      const socketUser: SocketUser = { playerId: userId, socketId: socket.id, userName: "Player" + userId, inGame: true, currentHand: [] };
      const gameId = this.handleJoin(deckId, socketUser);
      socket.join('room' + gameId);
      const game = this.games.filter(game => game.id == gameId)[0];
      if (game.full) {
        this.io.to('room' + gameId).emit(ServerSocketMessage.StartGame, gameId);
        this.sendOutCards(game);
      }

      socket.on(ClientSocketMessage.ChooseCard, (drawData) => {
        const game = this.games.filter(game => game.players.filter((player => player.socketId == socket.id)).length > 0)[0];
        const playerIndex = game.players.findIndex(player => player.socketId == socket.id);

        var nextPlayer = this.getNextPlayer(playerIndex, game);

        this.io.to(nextPlayer.socketId).emit(ServerSocketMessage.PreviewCardDraw, drawData);
      })

      socket.on(ClientSocketMessage.SendCard, (card) => {
        const game = this.games.filter(game => game.players.filter((player => player.socketId == socket.id)).length > 0)[0];
        const playerIndex = game.players.findIndex(player => player.socketId == socket.id);
        const giver = game.players[playerIndex];
        const receiver = this.getPrecedentPlayer(playerIndex, game);
        const cardIndex = giver.currentHand.findIndex(playerCard => playerCard.id == card.id);
        const cardPassed = giver.currentHand[cardIndex];
        receiver.currentHand.push(cardPassed);
        this.io.to(receiver.socketId).emit(ServerSocketMessage.SendCard, { id: cardPassed.id, latex: cardPassed.latex });
        giver.currentHand.splice(cardIndex, 1);
        this.io.to(giver.socketId).emit(ServerSocketMessage.DrawCard);
        if (giver.currentHand.length == 0) {
          giver.inGame = false;
          game.result.push(giver.playerId);
          this.io.to('room' + game.id).emit(ServerSocketMessage.PlayerOut, giver.playerId);
          const inGamePlayers = game.players.filter(p => p.inGame);
          if (inGamePlayers.length == 1) {
            this.io.to('room' + game.id).emit(ServerSocketMessage.EndGame, { 'result': game.result, 'loser': inGamePlayers[0].playerId, 'complete': true })
          }
        }

        this.io.to('room' + game.id).emit(ServerSocketMessage.StartPairing);
      })

      socket.on(ClientSocketMessage.EndTurn, () => {
        const game = this.games.filter(game => game.players.filter((player => player.socketId == socket.id)).length > 0)[0];
        const playerIndex = game.players.findIndex(player => player.socketId == socket.id);
        var nextDrawer = this.getNextPlayer(playerIndex, game);
        const nextIndex = game.players.findIndex(player => player.socketId == nextDrawer.socketId);
        var nextGiver = this.getNextPlayer(nextIndex, game);
        this.io.to('room' + game.id).emit(ServerSocketMessage.StartTurn, { drawer: nextDrawer.playerId, drawFrom: nextGiver.playerId });
        game.gameState = {
          convLess: undefined,
          convGreater: undefined,
          divLess: undefined,
          divGreater: undefined
        }
      })
      //TODO: nextPlayer emit this.io.to('room'+game.id).emit('nextPlayer', {drawer: giver.playerId, drawFrom:nextGiver.playerId});

      socket.on(ClientSocketMessage.PutDown, (putDownData) => {
        const game = this.games.filter(game => game.players.filter((player => player.socketId == socket.id)).length > 0)[0];
        const player = game.players.filter((player => player.socketId == socket.id))[0];
        const currentCard = player.currentHand.filter(c => c.id.toString() == putDownData.card.id)[0];
        this.placeCardInSpot(game, putDownData.cardPlacement, currentCard);
        this.io.to('room' + game.id).emit(ServerSocketMessage.PutDown, putDownData);
        const checkResult = checkPairs(game);
        if (checkResult.valid) {
          const lessIndex = player.currentHand.indexOf(player.currentHand.filter(card => card.id.toString() == checkResult.less.id)[0]);
          player.currentHand.splice(lessIndex, 1);
          const greaterIndex = player.currentHand.indexOf(player.currentHand.filter(card => card.id.toString() == checkResult.greater.id)[0]);
          player.currentHand.splice(greaterIndex, 1);
        }
        if (player.currentHand.length == 0) {
          player.inGame = false;
          game.result.push(player.playerId);
          this.io.to('room' + game.id).emit(ServerSocketMessage.PlayerOut, player.playerId);
          const inGamePlayers = game.players.filter(p => p.inGame);
          if (inGamePlayers.length == 1) {
            this.io.to('room' + game.id).emit(ServerSocketMessage.EndGame, { 'result': game.result, 'loser': inGamePlayers[0].playerId, 'complete': true })
          }
        }
      })

      socket.on(ClientSocketMessage.PutDownMove, (moveData) => {
        const game = this.games.filter(game => game.players.filter((player => player.socketId == socket.id)).length > 0)[0];
        const player = game.players.filter((player => player.socketId == socket.id))[0];
        const currentCard = player.currentHand.filter(c => c.id.toString() == moveData.card.id)[0];
        this.placeCardInSpot(game, moveData.newPlacement, currentCard);
        this.deleteCardFromSpot(game, moveData.prevthis.iousPlacement);
        this.io.to('room' + game.id).emit(ServerSocketMessage.PutDownMove, moveData);
        const checkResult = checkPairs(game);
        if (checkResult.valid) {
          const lessIndex = player.currentHand.indexOf(player.currentHand.filter(card => card.id.toString() == checkResult.less.id)[0]);
          const greaterIndex = player.currentHand.indexOf(player.currentHand.filter(card => card.id.toString() == checkResult.greater.id)[0]);
          player.currentHand.splice(lessIndex, 1);
          player.currentHand.splice(greaterIndex, 1);
        }
        if (player.currentHand.length == 0) {
          player.inGame = false;
          game.result.push(player.playerId);
          this.io.to('room' + game.id).emit(ServerSocketMessage.PlayerOut, player.playerId);
          const inGamePlayers = game.players.filter(p => p.inGame);
          if (inGamePlayers.length == 1) {
            this.io.to('room' + game.id).emit(ServerSocketMessage.EndGame, { 'result': game.result, 'loser': inGamePlayers[0].playerId, 'complete': true })
          }
        }
      })

      socket.on(ClientSocketMessage.PickUp, (putBackData) => {
        const game = this.games.filter(game => game.players.filter((player => player.socketId == socket.id)).length > 0)[0];
        this.deleteCardFromSpot(game, putBackData.cardPlacement);
        this.io.to('room' + game.id).emit(ServerSocketMessage.PickUp, putBackData);
      })

      socket.on('disconnect', () => {
        console.log('A client disconnected:', socket.id);
        const game = this.games.filter(game => game.players.filter((player => player.socketId == socket.id)).length > 0)[0];
        //if the game hasn't started yet, simply disconnect the player
        if (game && !game.full) {
          var index = this.games.indexOf(game);
          game.players.splice(index, 1);
        } else if(game) {
          this.io.to('room'+game.id).emit(ServerSocketMessage.EndGame, { 'result': game.result, 'complete': false })
        }
        //if the game is already in progress
        //TODO: robot player?
      });
    });

    function checkPairs(game: Game) {
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
        this.io.to('room' + game.id).emit('pairFeedback', res);
      }
      return res;
    }
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

  checkPair(less: CardExtended, greater: CardExtended, convergent: boolean): PairingNotification {
    var output: PairingNotification = {
      valid: false,
      message: "Different convergence property.",
      less: { id: less.id.toString(), latex: less.latex },
      greater: { id: greater.id.toString(), latex: greater.latex }
    };
    if (less.convergent != greater.convergent) output.message = "Different convergence property.";
    if (less.groupId != greater.groupId || less.simple == greater.simple) output.message = "Not a valid pair.";
    else if (less.convergent != convergent) output.message = "Incorrect guess of convergence.";
    else if ((convergent && less.simple) || (!convergent && greater.simple)) output.message = "Incorrect direction of estimation, members of the pair should be switched.";
    else output = {
      valid: true,
      convergent: greater.convergent,
      less: { id: less.id.toString(), latex: less.latex },
      greater: { id: greater.id.toString(), latex: greater.latex }
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
      return { id: item.id, latex: item.latex };
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
