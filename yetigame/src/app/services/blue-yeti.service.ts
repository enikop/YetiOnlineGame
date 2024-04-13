import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Socket, io } from 'socket.io-client';
import { SimpleCard } from '../blue-yeti/blue-yeti.component';
import { ClientSocketMessage, ServerSocketMessage } from '../../../models';

export type SpotType = 'div-less-spot' | 'div-greater-spot' | 'conv-less-spot' | 'conv-greater-spot';

interface Message {
  type: ServerSocketMessage,
  data: any
}

@Injectable({
  providedIn: 'root'
})
export class BlueYetiService {
  private socket!: Socket;
  private blueyetiSubject: Subject<Message> = new Subject<Message>();

  constructor() {
   }
  connect(deckId:number, userId:string){
    this.socket = io({query: {
      deckId: deckId,
      userId: userId,
    }});

    this.socket.on(ServerSocketMessage.StartGame, (gameId) =>{
      const id = gameId;
      console.log(gameId+' game starts');
    });
    this.socket.on(ServerSocketMessage.InitHand, (hand) =>{
      this.blueyetiSubject.next({type: ServerSocketMessage.InitHand, data: JSON.parse(hand)});
    });
    this.socket.on(ServerSocketMessage.PreviewCardDraw, (drawData)=>{
      this.blueyetiSubject.next({type: ServerSocketMessage.PreviewCardDraw, data: drawData});
    });
    this.socket.on(ServerSocketMessage.DrawCard, ()=>{
      this.blueyetiSubject.next({type: ServerSocketMessage.DrawCard, data: undefined});
    });
    this.socket.on(ServerSocketMessage.SendCard, (cardReceived)=>{
      this.blueyetiSubject.next({type: ServerSocketMessage.SendCard, data: cardReceived});
    });
    this.socket.on(ServerSocketMessage.StartPairing, ()=>{
      this.blueyetiSubject.next({type: ServerSocketMessage.StartPairing, data: undefined});
    });
    this.socket.on(ServerSocketMessage.StartTurn, (playersData)=>{
      this.blueyetiSubject.next({type: ServerSocketMessage.StartTurn, data: playersData});
    });
    this.socket.on(ServerSocketMessage.PutDown, (placementData)=>{
      this.blueyetiSubject.next({type: ServerSocketMessage.PutDown, data: placementData});
    });
    this.socket.on(ServerSocketMessage.PutDownMove, (placementData)=>{
      this.blueyetiSubject.next({type: ServerSocketMessage.PutDownMove, data: placementData});
    });
    this.socket.on(ServerSocketMessage.PickUp, (placementData)=>{
      this.blueyetiSubject.next({type: ServerSocketMessage.PickUp, data: placementData});
    });
    this.socket.on(ServerSocketMessage.PairFeedback, (feedbackData)=>{
      this.blueyetiSubject.next({type: ServerSocketMessage.PairFeedback, data: feedbackData});
    });
    this.socket.on(ServerSocketMessage.PlayerOut, (id)=>{
      this.blueyetiSubject.next({type: ServerSocketMessage.PlayerOut, data: id});
    });
    this.socket.on(ServerSocketMessage.EndGame, (resultData)=>{
      this.blueyetiSubject.next({type: ServerSocketMessage.EndGame, data: resultData});
    })
  }

  giveCard(card: SimpleCard){
    this.socket.emit(ClientSocketMessage.SendCard, card);
  }

  drawCard(cardIndex: number, userId: string){
    this.socket.emit(ClientSocketMessage.ChooseCard, {userId: userId, cardIndex: cardIndex});
  }

  endTurn(){
    this.socket.emit(ClientSocketMessage.EndTurn);
  }

  placeCard(card: SimpleCard, place: SpotType,  userId: string){
    this.socket.emit(ClientSocketMessage.PutDown, {userId: userId, card: card, cardPlacement: place})
  }

  moveCard(card: SimpleCard, prevPlace: SpotType, newPlace:SpotType, userId:string){
    this.socket.emit(ClientSocketMessage.PutDownMove, {userId: userId, card: card, previousPlacement: prevPlace, newPlacement: newPlace})
  }

  replaceCard(card: SimpleCard, place: SpotType,  userId: string){
    this.socket.emit(ClientSocketMessage.PickUp, {userId: userId, card: card, cardPlacement: place})
  }

  getObservable() {
    return this.blueyetiSubject;
  }
}
