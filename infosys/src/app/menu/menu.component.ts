import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { DeckService } from '../services/deck.service';
import { DeckDTO } from '../models/dto';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css'
})
export class MenuComponent {

  router:Router;
  deckService: DeckService;
  isPractiseSelected:boolean = false;
  decks: DeckDTO[] = [];
  gameSelected: string = 'yeti';

  constructor(router:Router, deckService: DeckService){
    this.router = router,
    this.deckService = deckService;
  }

  showDeckSelectionWindow(isPractise:boolean){
    this.deckService.getAll().subscribe({
      next: (decks) => {
        this.decks = decks;
        const choiceContainer = document.getElementById(isPractise ? 'deck-choice-practise' : 'deck-choice-play')!;
        choiceContainer.classList.toggle('choice-disabled');
        choiceContainer.innerHTML = '';
        this.decks.forEach((deck)=>{
          const newDiv = document.createElement("div");
          newDiv.classList.add('deck-card');
          newDiv.innerHTML = '<div><h3>Deck '+deck.id+'</h3><span>Type: </span>'+deck.type+'</div><div><span>Level: </span>'+deck.level+'</div>';
          newDiv.addEventListener('click', (event)=> {this.navigateAway(deck.id)});
          choiceContainer.appendChild(newDiv);
        })
        if(!isPractise){
          document.getElementById('game-choice')!.classList.toggle('choice-disabled');
        }
      },
      error: (error) => {
        console.error('Error fetching decks:', error.message);
      }  
    })
  }
  navigateAway(deckId:number) {
    if(this.isPractiseSelected){
      this.router.navigate(["/quiz/"+deckId]);
    }else{
      this.router.navigate(["/"+this.gameSelected+"/"+deckId]);
      //TODO: Navigate to play
    }
  }
  selectGame(gameName:string){
    this.gameSelected = gameName;
    Array.from(document.getElementsByClassName('game-card')).forEach(element => {
        element.classList.remove('selected-game');
    });
    document.getElementById(gameName)!.classList.add('selected-game');
  }
  hideAllSelectionWindows(exceptions:string[]){
    Array.from(document.getElementsByClassName('choice')).forEach(element => {
      if(element.getAttribute('id')!= null && !exceptions.includes(element.getAttribute('id')!)){
        element.classList.add('choice-disabled');
      }
    });;
  }
  startPractise(){
    this.hideAllSelectionWindows(['deck-choice-practise']);
    this.isPractiseSelected = true;
    this.showDeckSelectionWindow(true);
  }

  startPlay(){
    this.hideAllSelectionWindows(['game-choice','deck-choice-play']);
    this.isPractiseSelected = false;
    this.showDeckSelectionWindow(false);
  }
}
