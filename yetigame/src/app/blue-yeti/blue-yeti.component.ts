import { ChangeDetectorRef, Component, ElementRef, QueryList, ViewChildren } from '@angular/core';
import { BlueYetiService, SpotType } from '../services/blue-yeti.service';
import { ActivatedRoute } from '@angular/router';
import { CardDTO} from '../models/dto';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { renderLatex } from '../latexhandler';
import { Subscription } from 'rxjs';
import { ServerSocketMessage } from '../../../models';

export interface SimpleCard{
  id: string,
  latex: string
}

type TurnPhase = 'draw' | 'pair';

interface Player{
  playerId: string,
  userName: string,
  cardNumber: number
}

interface Pair{
  less: SimpleCard,
  greater: SimpleCard,
  convergent: boolean
}

@Component({
  selector: 'app-blue-yeti',
  standalone: true,
  imports: [DragDropModule, CommonModule],
  templateUrl: './blue-yeti.component.html',
  styleUrl: './blue-yeti.component.css'
})
export class BlueYetiComponent {
  private pairing_time = 60;
  private drawing_time = 20;
  private isTimerResetting = false;
  timer : number = this.drawing_time;
  DECK_SIZE: number = 29;
  CARD_WIDTH: number = 210;
  CARD_HEIGHT: number = 140;
  myId: string = "";
  players: Player[] = [
  { playerId: '1', userName: 'deathly_hallow', cardNumber: 0 },
  { playerId: '2', userName: 'vincent', cardNumber: 4 },
  { playerId: '3', userName: 'malfoyd', cardNumber: 8 },
  { playerId: '4', userName: 'hedwig', cardNumber: 7 }
  ];
  currentDeck: (CardDTO | string)[] = ['y'];
  handSubscription: Subscription | undefined;
  giveCardSubscription: Subscription | undefined;
  @ViewChildren('cardCanvas') canvasRefs!: QueryList<ElementRef<HTMLCanvasElement>>;
  @ViewChildren('convPairCanvas') convPairRefs!: QueryList<ElementRef<HTMLCanvasElement>>;
  @ViewChildren('divPairCanvas') divPairRefs!: QueryList<ElementRef<HTMLCanvasElement>>;

  divergentLessSlot:SimpleCard[]=[];
  divergentGreaterSlot:SimpleCard[]=[];
  convergentLessSlot:SimpleCard[]=[];
  convergentGreaterSlot:SimpleCard[]=[];

  previousPairs: Pair[] = [];

  isSidebarActive: boolean = false;

  firstRow: SimpleCard[] = [
    { id: '1', latex: '\\frac{a}{b}' },
    { id: '2', latex: '\\sqrt{x}' },
    { id: '3', latex: 'e^{i\\pi} + 1 = 0' },
    { id: '4', latex: '\\int_{a}^{b} f(x) \\,dx' }
  ];
  secondRow: SimpleCard[] =  [
    { id: '5', latex: '\\frac{4}{5}' },
    { id: '6', latex: '\\sqrt{9}' },
    { id: '7', latex: 'e^{234\\pi} + 1 = 0' },
    { id: '8', latex: '\\int_{6}^{7} f(x) \\,dx' }
  ];
  turnId:string ="";
  pullFromId:string ="";
  turnPhase: TurnPhase = 'draw';
  blueYetiService!: BlueYetiService;
  drawIndex: number = -1;
  yetiImage!: HTMLImageElement;
  result: string[] = [];
  newCardId:string = '';

  constructor(
    private currentRoute: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) { }



  ngOnInit(): void {
    this.yetiImage = new Image();
    //load resources then initialize game
    this.yetiImage.addEventListener("load", () => {
      this.initializeGame();
      const interval = setInterval(() => {
        if(this.isTimerResetting){
          this.setTimer();
        }
        if (--this.timer <= 0) {
          this.setTimer();
          //clearInterval(interval);
        }
    }, 1000);
    });
    this.yetiImage.src = '../../assets/yeti.png';
  }

  setTimer(){
    if(this.turnPhase == 'draw'){
      this.timer = this.drawing_time;
    } else {
      this.timer = this.pairing_time;
    }
  }

  initializeGame(){
    //start socket communication with server, initialize observer subscription
    const deckId = this.currentRoute.snapshot.params['deckId'];
    this.blueYetiService = new BlueYetiService();
    this.myId = Math.floor(Math.random() * 100).toString(); //temp line
    this.blueYetiService.connect(deckId, this.myId);
    this.handSubscription = this.blueYetiService.getObservable().subscribe((received) => {
      if(received.type == ServerSocketMessage.InitHand){
        this.refreshFullGameState(received.data);
      } else if(received.type == ServerSocketMessage.PreviewCardDraw){
        this.giveCard(received.data);
      } else if(received.type == ServerSocketMessage.DrawCard){
        this.pullCard();
      } else if(received.type == ServerSocketMessage.SendCard){
        this.receiveCard(received.data);
      } else if(received.type == ServerSocketMessage.StartPairing){
        this.startPairingPhase();
      } else if(received.type == ServerSocketMessage.StartTurn){
        this.nextPlayerTurn(received.data);
      } else if(received.type == ServerSocketMessage.PutDown){
        this.placeCardDown(received.data);
      } else if(received.type == ServerSocketMessage.PutDownMove){
        this.moveCard(received.data);
      }else if(received.type == ServerSocketMessage.PickUp){
        this.placeCardBack(received.data);
      }else if(received.type == ServerSocketMessage.PairFeedback){
        this.processFeedback(received.data);
      }else if(received.type == ServerSocketMessage.PlayerOut){
        this.handlePlayerOut(received.data);
      }else if(received.type == ServerSocketMessage.EndGame){
        this.handleGameOver(received.data);
      }
    });
  }

  handleGameOver(resultData: any){
    if(resultData.complete){
      this.result = resultData.result;
      this.result.push(resultData.loser);
      if(resultData.loser == this.myId){
        window.alert('You lost :(');
      }
    } else {
      window.alert('Game compromised.');
    }
  }
  handlePlayerOut(id:string){
    window.alert('Player out: '+id);
    if(id==this.turnId){
      this.blueYetiService.endTurn();
    }
  }
  getAllMyCards(){
    const output = [...this.firstRow, ...this.secondRow];
    if(this.turnId == this.myId){
      return [...output, ...this.divergentLessSlot, ...this.divergentGreaterSlot, ...this.convergentLessSlot, ...this.convergentGreaterSlot];
    } else return output;
  }

  processFeedback(feedbackData: any){
    //Actions for current player
    if(this.turnId == this.myId && feedbackData.valid){
      window.alert("Ügyes!");
    }
    if(this.turnId == this.myId && !feedbackData.valid) window.alert(feedbackData.message);

    //Actions for everybody
    if(feedbackData.valid){
      if(feedbackData.convergent){
        this.convergentLessSlot.splice(0);
        this.convergentGreaterSlot.splice(0);
      } else {
        this.divergentLessSlot.splice(0);
        this.divergentGreaterSlot.splice(0);
      }
      this.previousPairs.push({less:feedbackData.less, greater:feedbackData.greater, convergent: feedbackData.convergent});
      this.cdr.detectChanges();
      this.drawAllFormulas();
      this.drawPairs();
    } else {
      //TODO: implement stealing
    }

  }

  moveCard(placementData: any){
    //Vanish from previous place, appear on new place
    this.placeCardDown({userId: placementData.userId, cardPlacement: placementData.newPlacement, card: placementData.card});
    this.placeCardBack({userId: placementData.userId, cardPlacement: placementData.previousPlacement, card: placementData.card});
  }

  placeCardDown(placementData: any){
    if(placementData.userId == this.myId) return;
    this.players.filter(player => player.playerId == placementData.userId)[0].cardNumber--;
    switch(placementData.cardPlacement){
      case 'div-less-spot': {
        this.divergentLessSlot.push(placementData.card);
        break;
      }
      case 'div-greater-spot': {
        this.divergentGreaterSlot.push(placementData.card);
        break;
      }
      case 'conv-less-spot': {
        this.convergentLessSlot.push(placementData.card);
        break;
      }
      case 'conv-greater-spot': {
        this.convergentGreaterSlot.push(placementData.card);
        break;
      }
    }
    this.cdr.detectChanges();
    this.drawAllFormulas();
  }

  placeCardBack(placementData: any){
    //If I was the one playing a card, do nothing
    if(placementData.userId == this.myId) return;
    this.players.filter(player => player.playerId == placementData.userId)[0].cardNumber++;
    //If not, place the card in the corresponding spot
    switch(placementData.cardPlacement){
      case 'div-less-spot': {
        this.divergentLessSlot.splice(0);
        break;
      }
      case 'div-greater-spot': {
        this.divergentGreaterSlot.splice(0);
        break;
      }
      case 'conv-less-spot': {
        this.convergentLessSlot.splice(0);
        break;
      }
      case 'conv-greater-spot': {
        this.convergentGreaterSlot.splice(0);
        break;
      }
    }
    this.cdr.detectChanges();
    this.drawAllFormulas();
  }

  nextPlayerTurn(playersData:any){
    //Delete or put back placed center cards
    this.putPlacedCardsBack();

    //Switch to next player's turn
    this.turnId = playersData.drawer;
    this.pullFromId = playersData.drawFrom;

    this.turnPhase = 'draw';
  }

  endTurn(){
    this.blueYetiService.endTurn();
  }

  startPairingPhase(){
    //Adjust the number of cards of each player
    var indexOfGiver = this.players.findIndex(player => player.playerId == this.pullFromId);
    var indexOfReceiver = this.players.findIndex(player => player.playerId == this.turnId);
    this.players[indexOfGiver].cardNumber--;
    this.players[indexOfReceiver].cardNumber++;

    this.turnPhase = 'pair';

  }

  putPlacedCardsBack(){
    var allCards = [...this.firstRow, ...this.secondRow];
    const centerCards = [...this.divergentLessSlot, ...this.divergentGreaterSlot, ...this.convergentLessSlot, ...this.convergentGreaterSlot];
    if(this.turnId == this.myId){
      allCards = [...allCards, ...centerCards];
    } else {
      const currentPlayer = this.players.filter(player => player.playerId == this.turnId)[0];
      currentPlayer.cardNumber += centerCards.length;
    }
    this.divergentLessSlot.splice(0);
    this.divergentGreaterSlot.splice(0);
    this.convergentGreaterSlot.splice(0);
    this.convergentLessSlot.splice(0);
    this.refreshHand(allCards);
  }

  receiveCard(cardData: any){
    var card: SimpleCard = cardData;
    this.newCardId = card.id;
    var concatHand = [...this.firstRow, ...this.secondRow];
    const randomIndex = Math.floor(Math.random() * (concatHand.length + 1));
    concatHand.splice(randomIndex, 0, card);
    this.refreshHand(concatHand);

  }
  giveCard(drawData:any){
    this.drawIndex = drawData.cardIndex;
    var concatHand = [...this.firstRow, ...this.secondRow];
    if(concatHand[this.drawIndex].id == this.newCardId){
      this.newCardId = '';
    }
    this.blueYetiService.giveCard(concatHand[this.drawIndex]);
  }

  pullCard(){
    if(this.drawIndex<4){
      this.firstRow.splice( this.drawIndex, 1);
    } else {
      this.secondRow.splice( this.drawIndex-4, 1);
    }
    var concatHand = [...this.firstRow, ...this.secondRow];
    this.refreshHand(concatHand);
  }

  ngOnDestroy(): void {
    if (this.handSubscription) {
      this.handSubscription.unsubscribe();
    }
  }

  ngAfterViewInit() {
    this.drawAllFormulas();
    this.drawPairs();
  }


  onDrop(event: CdkDragDrop<SimpleCard[]>) {
    var commonCardSlotIds = ["div-less-spot", "div-greater-spot", "conv-less-spot", "conv-greater-spot"];
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      if(commonCardSlotIds.includes(event.container.id) && (this.turnId != this.myId || event.container.data.length>0 || this.turnPhase != 'pair')) return;
      else if(commonCardSlotIds.includes(event.previousContainer.id) && (this.turnId != this.myId || this.turnPhase != 'pair')) return;
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
      if (event.container.id === 'first-row' && this.firstRow.length > 4) {
        this.secondRow.splice(0, 0, this.firstRow.pop()!);
      } else  if (event.container.id === 'second-row' && this.secondRow.length > 4)  {
        this.firstRow.push(this.secondRow.shift()!);
      } else if(commonCardSlotIds.includes(event.container.id) && commonCardSlotIds.includes(event.previousContainer.id)) {
        this.blueYetiService.moveCard(event.container.data[event.currentIndex], event.previousContainer.id as SpotType, event.container.id as SpotType, this.myId);
      }else if(commonCardSlotIds.includes(event.container.id)) {
        this.blueYetiService.placeCard(event.container.data[event.currentIndex], event.container.id as SpotType, this.myId);
      } else if(commonCardSlotIds.includes(event.previousContainer.id) && (event.container.id === 'first-row' || event.container.id === 'second-row')) {
        this.blueYetiService.replaceCard(event.container.data[event.currentIndex], event.previousContainer.id as SpotType, this.myId);
      }
      this.cdr.detectChanges();
      this.drawAllFormulas();
    }
  }

  onCardHover(event: MouseEvent) {
    const cardElement = event.target as HTMLElement;
    cardElement.classList.add('hovered');
  }

  onCardLeave(event: MouseEvent) {
    const cardElement = event.target as HTMLElement;
    cardElement.classList.remove('hovered');
  }

  onCardClick(player:Player, clickedIndex: number){
    if(this.turnId == this.myId && player.playerId == this.pullFromId && this.turnPhase == 'draw'){
      this.blueYetiService.drawCard(clickedIndex, this.myId);
    }
    else console.log("Cannot pull card from this player");
  }


  refreshFullGameState(hand:any){
    var concatHand: SimpleCard[] = hand.hand;
    //get players and shift array so that the current player is the first (order is preserved)
    var players: Player[] = hand.players;
    this.refreshPlayers(players);
    this.refreshHand(concatHand);
  }

  refreshHand(concatHand: SimpleCard[]){
    this.firstRow.splice(0, this.firstRow.length, ...concatHand.slice(0,4));
    this.secondRow.splice(0, this.secondRow.length, ...concatHand.slice(4));
    this.cdr.detectChanges();
    this.drawAllFormulas();
  }

  refreshPlayers(players:Player[]){
    this.turnId = players[0].playerId;
    const index = players.findIndex(player => player.playerId == this.myId.toString());
    if (index != -1) {
        this.players = players.slice(index).concat(players.slice(0, index));
        this.pullFromId = players[1].playerId;
    } else {
        //TODO: exception
    }
  }

  drawAllFormulas() {
    this.canvasRefs.forEach((canvasRef) => {
      var id = canvasRef.nativeElement.id.split('-')[1];
      var concatHand = [...this.firstRow, ...this.secondRow, ...this.divergentGreaterSlot, ...this.divergentLessSlot, ...this.convergentGreaterSlot, ...this.convergentLessSlot];
      if(id == this.newCardId){
        this.drawFormulaOntoCanvas(document.getElementById(canvasRef.nativeElement.id) as HTMLCanvasElement, concatHand.filter(card => card.id == id)[0].latex, this.CARD_HEIGHT, this.CARD_WIDTH, true);
      } else{
        this.drawFormulaOntoCanvas(document.getElementById(canvasRef.nativeElement.id) as HTMLCanvasElement, concatHand.filter(card => card.id == id)[0].latex, this.CARD_HEIGHT, this.CARD_WIDTH);
      }
    });
  }

  drawPairs(){
    this.convPairRefs.forEach((canvas)=>{
      var id = parseInt(canvas.nativeElement.id.split('-')[1]);
      var pair = this.getConvergentPreviousPairs()[id];
      this.drawFormulaOntoCanvas(document.getElementById(canvas.nativeElement.id) as HTMLCanvasElement, pair.less.latex+"<"+pair.greater.latex, 75, 300);
    })
    this.divPairRefs.forEach((canvas)=>{
      var id = parseInt(canvas.nativeElement.id.split('-')[1]);
      var pair = this.getDivergentPreviousPairs()[id];
      this.drawFormulaOntoCanvas(document.getElementById(canvas.nativeElement.id) as HTMLCanvasElement, pair.less.latex+"<"+pair.greater.latex, 75, 300);
    })
  }

  drawFormulaOntoCanvas(canvas: HTMLCanvasElement, latex: string, height:number, width:number, isNew:boolean = false) {
    canvas.style.height = height + 'px';
    canvas.style.width = width + 'px';
    canvas.height = height * 3;
    canvas.width = width * 3;
    if(latex=='y'){
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(this.yetiImage, 0, 0, canvas.width, canvas.height);
    } else{
      var equationImage = new Image();
      equationImage.addEventListener("load", () => {
        const ctx = canvas.getContext("2d")!;
        let latexWidth = equationImage.naturalWidth*4;
        let latexHeight = equationImage.naturalHeight*4;
        let currentY = canvas.height / 2 - latexHeight / 2;
        let currentX = canvas.width / 2 - latexWidth / 2;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if(isNew){
          ctx.fillStyle = '#0B1A41';
          ctx.fillRect(0,0,canvas.width/15, canvas.height);
        }
        ctx.drawImage(equationImage, currentX, currentY, Math.min(latexWidth, canvas.width), Math.min(latexHeight, canvas.height));

      });
      equationImage.src = renderLatex(latex);
    }

  }

  repeatArray(length: number): any[] {
    return Array.from({ length }, (_, index) => index);
  }

  getConvergentPreviousPairs(): Pair[] {
    return this.previousPairs.filter(pair => pair.convergent);
  }

  getDivergentPreviousPairs(): Pair[] {
    return this.previousPairs.filter(pair => !pair.convergent);
  }

  toggleSidebar():void{
    this.isSidebarActive = !this.isSidebarActive;
  }
}
