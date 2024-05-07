export enum ServerSocketMessage {
  StartGame = 'startGame',
  InitHand = 'initHand',
  PreviewCardDraw = 'previewCardDraw',
  SendCard = 'sendCard',
  DrawCard = 'drawCard',
  StartPairing = 'startPairing',
  StartTurn = 'startTurn',
  PutDown = 'putDown',
  PutDownMove = 'putDownMove',
  PickUp = 'pickUp',
  PairFeedback = 'pairFeedback',
  PlayerOut = 'playerOut',
  EndGame = 'endGame',
  TimerState = 'timerState'
}

export enum ClientSocketMessage {
  ChooseCard = 'chooseCard',
  SendCard = 'sendCard',
  EndTurn = 'endTurn',
  PutDown = 'putDown',
  PutDownMove = 'putDownMove',
  PickUp = 'pickUp',
}

export interface SocketUser {
  socketId: string;
  playerId: string;
  userName: string;
  inGame: boolean;
  leftGame: boolean;
  currentHand: CardExtended[];
}
export interface Game {
  id: number;
  deckId: string;
  full: boolean;
  players: SocketUser[];
  gameState: GameState;
  result: string[];
  timer: number;
  resetDrawingTimer: boolean;
  resetPairingTimer: boolean;
  isDrawingTimerRunning: boolean;
  isPairingTimerRunning: boolean;
}
export interface CardExtended {
  id: number;
  latex: string;
  simple: boolean;
  groupId: number;
  subtype: string;
  convergent: boolean;
}
interface SimpleCard {
  id: string;
  latex: string;
}
interface GameState {
  convLess: CardExtended;
  convGreater: CardExtended;
  divLess: CardExtended;
  divGreater: CardExtended;
}
export interface PairingNotification {
  valid: boolean;
  convergent?: boolean;
  message?: string;
  less: SimpleCard;
  greater: SimpleCard;
}

