import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { BlueYetiService, SpotType } from '../services/blue-yeti.service';
import { ActivatedRoute, Router } from '@angular/router';
import { CardDTO } from '../models/dto';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { get_mathjax_svg } from '../latexhandler';
import { Subscription } from 'rxjs';
import { DRAW_TIME, EndGameUserData, ServerSocketMessage, SimpleCard } from '../../../models';
import { ComparisonTestModalComponent } from '../comparison-test-modal/comparison-test-modal.component';
import { DeckService } from '../services/deck.service';
import { ExplanationsComponent } from '../explanations/explanations.component';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

type TurnPhase = 'draw' | 'wait' | 'pair';

interface Player {
    playerId: string,
    userName: string,
    cardNumber: number
}

interface Pair {
    less: SimpleCard,
    greater: SimpleCard,
    convergent: boolean
}

@Component({
    selector: 'app-blue-yeti',
    standalone: true,
    imports: [DragDropModule, CommonModule, ComparisonTestModalComponent, ExplanationsComponent],
    templateUrl: './blue-yeti.component.html',
    styleUrl: './blue-yeti.component.css'
})
export class BlueYetiComponent implements OnInit, OnDestroy {
    timer: number = DRAW_TIME;
    CARD_WIDTH: number = 210;
    CARD_HEIGHT: number = 140;
    message = '';
    myId: string = "1";
    myUserName: string = "deathly_hallow";
    players: Player[] = [
        { playerId: this.myId, userName: this.myUserName, cardNumber: 0 },
        { playerId: '2', userName: 'vincent', cardNumber: 7 },
        { playerId: '3', userName: 'malfoyd', cardNumber: 7 },
        { playerId: '4', userName: 'hedwig', cardNumber: 7 }
    ];
    currentDeck: (CardDTO | string)[] = ['y'];
    handSubscription: Subscription | undefined;
    giveCardSubscription: Subscription | undefined;

    divergentLessSlot: SimpleCard[] = [];
    divergentGreaterSlot: SimpleCard[] = [];
    convergentLessSlot: SimpleCard[] = [];
    convergentGreaterSlot: SimpleCard[] = [];

    previousPairs: Pair[] = [];
    router = inject(Router);
    isSidebarActive: boolean = false;

    hasGameBegun = false;

    firstRow: SimpleCard[] = [];
    secondRow: SimpleCard[] = [];
    turnId: string = "";
    pullFromId: string = "";
    turnPhase: TurnPhase = 'draw';
    blueYetiService!: BlueYetiService;
    drawIndex: number = -1;
    yetiImage!: HTMLImageElement;
    result: EndGameUserData[] = [];
    newCardId: string = '';
    isSeries: boolean = true;
    isHelpModalOn = false;
    totalPairNumber = 0;
    isAssistedModeOn = true;
    deckService = inject(DeckService);
    currentRoute = inject(ActivatedRoute);
    cdr = inject(ChangeDetectorRef);
    sanitizer = inject(DomSanitizer);

    ngOnInit(): void {
        this.yetiImage = new Image();
        //load resources then initialize game
        this.yetiImage.addEventListener("load", () => {
            this.initializeGame();
        });
        this.yetiImage.src = '../../assets/yeti.png';
    }

    ngOnDestroy(): void {
        if (this.handSubscription) {
            this.handSubscription.unsubscribe();
        }
    }

    initializeGame() {
        //start socket communication with server, initialize observer subscription
        const deckId = this.currentRoute.snapshot.params['deckId'];
        //set assisted mode based on the path
        this.isAssistedModeOn = this.currentRoute.snapshot.url[0].path == 'blue-yeti-assisted';
        this.deckService.getOne(deckId).subscribe({
            next: (deck) => {
                this.isSeries = (deck.type != 'integrals');
            },
            error: (error) => {
                console.error('Error fetching cards:', error.message);
            }
        })
        this.blueYetiService = new BlueYetiService();
        this.myId = Math.floor(Math.random() * 100).toString(); //temp line
        this.myUserName = 'Player' + this.myId; //temp line
        this.blueYetiService.connect(deckId, this.myId);
        this.handSubscription = this.blueYetiService.getObservable().subscribe((received) => {
            if (received.type == ServerSocketMessage.InitHand) {
                this.refreshFullGameState(received.data);
            } else if (received.type == ServerSocketMessage.PreviewCardDraw) {
                this.giveCard(received.data);
            } else if (received.type == ServerSocketMessage.DrawCard) {
                this.pullCard();
            } else if (received.type == ServerSocketMessage.SendCard) {
                this.receiveCard(received.data);
            } else if (received.type == ServerSocketMessage.StartPairing) {
                this.startPairingPhase();
            } else if (received.type == ServerSocketMessage.StartTurn) {
                this.nextPlayerTurn(received.data);
            } else if (received.type == ServerSocketMessage.PutDown) {
                this.placeCardDown(received.data);
            } else if (received.type == ServerSocketMessage.PutDownMove) {
                this.moveCard(received.data);
            } else if (received.type == ServerSocketMessage.PickUp) {
                this.placeCardBack(received.data);
            } else if (received.type == ServerSocketMessage.PairFeedback) {
                this.processFeedback(received.data);
            } else if (received.type == ServerSocketMessage.PlayerOut) {
                this.handlePlayerOut(received.data);
            } else if (received.type == ServerSocketMessage.EndGame) {
                this.handleGameOver(received.data);
            } else if (received.type == ServerSocketMessage.TimerState) {
                this.timer = received.data;
            } else if (received.type == ServerSocketMessage.PairNumberAnswer) {
                this.totalPairNumber = received.data;
            }
        });
    }

    handleGameOver(resultData: any) {
        if (resultData.complete) {
            this.result = resultData.result;
            this.result.push(resultData.loser);
            if (resultData.loser.playerId == this.myId) {
                this.setMessage('You lost :(');
            }
        } else {
           this.setMessage('Somebody left the game. Robot player activated.');
        }
    }
    handlePlayerOut(id: string) {
        this.setMessage('Player out: ' + id);
        if (id == this.turnId && this.turnId == this.myId) {
            this.blueYetiService.endTurn();
        }
    }
    getAllMyCards() {
        const output = [...this.firstRow, ...this.secondRow];
        if (this.turnId == this.myId) {
            return [...output, ...this.divergentLessSlot, ...this.divergentGreaterSlot, ...this.convergentLessSlot, ...this.convergentGreaterSlot];
        } else return output;
    }

    processFeedback(feedbackData: any) {
        //Actions for current player
        if (this.turnId == this.myId && feedbackData.valid) {
            this.setMessage("Correct!");
            if (this.isAssistedModeOn) this.blueYetiService.inquirePairNumber();
        }
        if (this.turnId == this.myId && !feedbackData.valid) {
            this.setMessage(feedbackData.message);
            this.endTurn();
        }

        //Actions for everybody
        if (feedbackData.valid) {
            if (feedbackData.convergent) {
                this.convergentLessSlot.splice(0);
                this.convergentGreaterSlot.splice(0);
            } else {
                this.divergentLessSlot.splice(0);
                this.divergentGreaterSlot.splice(0);
            }
            this.previousPairs.push({ less: feedbackData.less, greater: feedbackData.greater, convergent: feedbackData.convergent });
            this.cdr.detectChanges();
        } else {
            //TODO: implement stealing
        }

    }

    moveCard(placementData: any) {
        //Vanish from previous place, appear on new place
        this.placeCardDown({ userId: placementData.userId, cardPlacement: placementData.newPlacement, card: placementData.card });
        this.placeCardBack({ userId: placementData.userId, cardPlacement: placementData.previousPlacement, card: placementData.card });
    }

    placeCardDown(placementData: any) {
        if (placementData.userId == this.myId) return;
        this.convertLatexToHtml([placementData.card]);
        this.players.filter(player => player.playerId == placementData.userId)[0].cardNumber--;
        switch (placementData.cardPlacement) {
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
    }

    placeCardBack(placementData: any) {
        //If I was the one playing a card, do nothing
        if (placementData.userId == this.myId) return;
        this.players.filter(player => player.playerId == placementData.userId)[0].cardNumber++;
        //If not, place the card in the corresponding spot
        switch (placementData.cardPlacement) {
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
    }

    nextPlayerTurn(playersData: any) {
        //Delete or put back placed center cards
        this.putPlacedCardsBack();

        //Switch to next player's turn
        this.turnId = playersData.drawer;
        this.pullFromId = playersData.drawFrom;

        this.turnPhase = 'draw';
    }

    endTurn() {
        this.blueYetiService.endTurn();
    }

    startPairingPhase() {
        //Adjust the number of cards of each player
        var indexOfGiver = this.players.findIndex(player => player.playerId == this.pullFromId);
        var indexOfReceiver = this.players.findIndex(player => player.playerId == this.turnId);
        this.players[indexOfGiver].cardNumber--;
        this.players[indexOfReceiver].cardNumber++;
        this.turnPhase = 'pair';

    }

    putPlacedCardsBack() {
        var allCards = [...this.firstRow, ...this.secondRow];
        const centerCards = [...this.divergentLessSlot, ...this.divergentGreaterSlot, ...this.convergentLessSlot, ...this.convergentGreaterSlot];
        if (this.turnId == this.myId) {
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

    receiveCard(cardData: any) {
        var card: SimpleCard = cardData;
        this.newCardId = card.id;
        this.convertLatexToHtml([card]);
        var concatHand = [...this.firstRow, ...this.secondRow];
        const randomIndex = Math.floor(Math.random() * (concatHand.length + 1));
        concatHand.splice(randomIndex, 0, card);
        this.refreshHand(concatHand);
        if (this.isAssistedModeOn) this.blueYetiService.inquirePairNumber();

    }
    giveCard(drawData: any) {
        this.drawIndex = drawData.cardIndex;
        var concatHand = [...this.firstRow, ...this.secondRow];
        if (concatHand[this.drawIndex].id == this.newCardId) {
            this.newCardId = '';
        }
        this.blueYetiService.giveCard(concatHand[this.drawIndex]);
    }

    pullCard() {
        if (this.drawIndex < 4) {
            this.firstRow.splice(this.drawIndex, 1);
        } else {
            this.secondRow.splice(this.drawIndex - 4, 1);
        }
        var concatHand = [...this.firstRow, ...this.secondRow];
        this.refreshHand(concatHand);
        if (this.isAssistedModeOn) this.blueYetiService.inquirePairNumber();
    }


    onDrop(event: CdkDragDrop<SimpleCard[]>) {
        var commonCardSlotIds = ["div-less-spot", "div-greater-spot", "conv-less-spot", "conv-greater-spot"];
        if (event.previousContainer === event.container) {
            moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
        } else {
            if (commonCardSlotIds.includes(event.container.id) && (this.turnId != this.myId || event.container.data.length > 0 || this.turnPhase != 'pair')) return;
            else if (commonCardSlotIds.includes(event.previousContainer.id) && (this.turnId != this.myId || this.turnPhase != 'pair')) return;
            transferArrayItem(
                event.previousContainer.data,
                event.container.data,
                event.previousIndex,
                event.currentIndex,
            );
            if (event.container.id === 'first-row' && this.firstRow.length > 4) {
                this.secondRow.splice(0, 0, this.firstRow.pop()!);
            } else if (event.container.id === 'second-row' && this.secondRow.length > 4) {
                this.firstRow.push(this.secondRow.shift()!);
            } else if (commonCardSlotIds.includes(event.container.id) && commonCardSlotIds.includes(event.previousContainer.id)) {
                this.blueYetiService.moveCard(event.container.data[event.currentIndex], event.previousContainer.id as SpotType, event.container.id as SpotType, this.myId);
            } else if (commonCardSlotIds.includes(event.container.id)) {
                this.blueYetiService.placeCard(event.container.data[event.currentIndex], event.container.id as SpotType, this.myId);
            } else if (commonCardSlotIds.includes(event.previousContainer.id) && (event.container.id === 'first-row' || event.container.id === 'second-row')) {
                this.blueYetiService.replaceCard(event.container.data[event.currentIndex], event.previousContainer.id as SpotType, this.myId);
            }
            this.cdr.detectChanges();
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

    onCardClick(player: Player, clickedIndex: number) {
        if (this.turnId == this.myId && player.playerId == this.pullFromId && this.turnPhase == 'draw') {
            this.blueYetiService.drawCard(clickedIndex, this.myId);
            this.turnPhase = 'wait'
        }
        else console.log("Cannot pull card from this player");
    }

    convertLatexToHtml(hand: SimpleCard[]){
      for(let card of hand){
        card.latex_html = this.transform(this.getLatex(card.latex));
      }
    }


    refreshFullGameState(hand: any) {
        var concatHand: SimpleCard[] = hand.hand;
        this.convertLatexToHtml(concatHand);
        //get players and shift array so that the current player is the first (order is preserved)
        var players: Player[] = hand.players;
        this.refreshPlayers(players);
        this.refreshHand(concatHand);
        if (this.isAssistedModeOn) this.blueYetiService.inquirePairNumber();
    }

    refreshHand(concatHand: SimpleCard[]) {
        this.firstRow.splice(0, this.firstRow.length, ...concatHand.slice(0, 4));
        this.secondRow.splice(0, this.secondRow.length, ...concatHand.slice(4));
        this.cdr.detectChanges();
    }

    refreshPlayers(players: Player[]) {
        this.turnId = players[0].playerId;
        const index = players.findIndex(player => player.playerId == this.myId.toString());
        if (index != -1) {
            this.players = players.slice(index).concat(players.slice(0, index));
            this.pullFromId = players[1].playerId;
        } else {
            //TODO: exception
        }
        this.hasGameBegun = true;
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

    toggleSidebar(): void {
        this.isSidebarActive = !this.isSidebarActive;
    }

    closeHelp() {
        this.isHelpModalOn = false;
    }

    openHelp() {
        this.isHelpModalOn = true;
    }

    backToMenu() {
        this.router.navigateByUrl('');
    }

    playAgain() {
        window.location.reload();
    }

    setMessage(message: string){
        this.message = message;
        setTimeout(()=>{
            this.message = '';
        }, 3000)
    }

    getLatex(formula: string) {
      return get_mathjax_svg( formula );
    }

    transform(svg: string): SafeHtml {
      return this.sanitizer.bypassSecurityTrustHtml(svg);
    }
}
