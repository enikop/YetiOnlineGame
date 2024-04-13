import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Socket, io } from 'socket.io-client';
import { SimpleCard } from '../blue-yeti/blue-yeti.component';

export type  MessageType = 'init' | 'give' | 'pulled' | 'received' | 'pair-start' | 'next' | 'put-down' |'move' |'put-back' | 'pair-feedback'
 | 'player-out' | 'game-over';
export type SpotType = 'div-less-spot' | 'div-greater-spot' | 'conv-less-spot' | 'conv-greater-spot';

interface Message {
  type: MessageType,
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

    this.socket.on('startGame', (gameId) =>{
      const id = gameId;
      console.log(gameId+' game starts');
    });
    this.socket.on('deckInit', (hand) =>{
      this.blueyetiSubject.next({type: 'init', data: JSON.parse(hand)});
    });
    this.socket.on('giveCard', (drawData)=>{
      this.blueyetiSubject.next({type: 'give', data: drawData});
    });
    this.socket.on('pulledCard', ()=>{
      this.blueyetiSubject.next({type: 'pulled', data: undefined});
    });
    this.socket.on('receivedCard', (cardReceived)=>{
      this.blueyetiSubject.next({type: 'received', data: cardReceived});
    });
    this.socket.on('startPairPhase', ()=>{
      this.blueyetiSubject.next({type: 'pair-start', data: undefined});
    });
    this.socket.on('nextPlayer', (playersData)=>{
      this.blueyetiSubject.next({type: 'next', data: playersData});
    });
    this.socket.on('placedCard', (placementData)=>{
      this.blueyetiSubject.next({type: 'put-down', data: placementData});
    });
    this.socket.on('movedCard', (placementData)=>{
      this.blueyetiSubject.next({type: 'move', data: placementData});
    });
    this.socket.on('replacedCard', (placementData)=>{
      this.blueyetiSubject.next({type: 'put-back', data: placementData});
    });
    this.socket.on('pairFeedback', (feedbackData)=>{
      this.blueyetiSubject.next({type: 'pair-feedback', data: feedbackData});
    });
    this.socket.on('playerOut', (id)=>{
      this.blueyetiSubject.next({type: 'player-out', data: id});
    });
    this.socket.on('gameOver', (resultData)=>{
      this.blueyetiSubject.next({type: 'game-over', data: resultData});
    })
  }

  giveCard(card: SimpleCard){
    this.socket.emit('give', card);
  }

  drawCard(cardIndex: number, userId: string){
    this.socket.emit('draw', {userId: userId, cardIndex: cardIndex});
  }

  endTurn(){
    this.socket.emit('endTurn');
  }

  placeCard(card: SimpleCard, place: SpotType,  userId: string){
    this.socket.emit('putDown', {userId: userId, card: card, cardPlacement: place})
  }

  moveCard(card: SimpleCard, prevPlace: SpotType, newPlace:SpotType, userId:string){
    this.socket.emit('moveAway', {userId: userId, card: card, previousPlacement: prevPlace, newPlacement: newPlace})
  }

  replaceCard(card: SimpleCard, place: SpotType,  userId: string){
    this.socket.emit('putBack', {userId: userId, card: card, cardPlacement: place})
  }

  getObservable() {
    return this.blueyetiSubject;
  }
}
