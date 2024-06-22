export const DRAW_TIME = 10;
export const PAIR_TIME = 50;

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
  TimerState = 'timerState',
  PairNumberAnswer = 'pairNumberAnswer'
}

export enum ClientSocketMessage {
  ChooseCard = 'chooseCard',
  SendCard = 'sendCard',
  EndTurn = 'endTurn',
  PutDown = 'putDown',
  PutDownMove = 'putDownMove',
  PickUp = 'pickUp',
  PairNumberInquiry = 'pairNumberInquiry'
}

export interface SocketUser {
  socketId: string;
  playerId: string;
  userName: string;
  inGame: boolean;
  leftGame: boolean;
  currentHand: CardExtended[];
  mistakeNum: number;
}

export interface EndGameUserData {
  playerId: string;
  userName: string;
  mistakeNum: number;
}
export interface Game {
  id: number;
  deckId: string;
  full: boolean;
  players: SocketUser[];
  gameState: GameState;
  result: EndGameUserData[];
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
export interface SimpleCard {
  id: string;
  latex: string;
  subtype: string;
}
export interface GameState {
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

