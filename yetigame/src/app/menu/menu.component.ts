import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { DeckService } from '../services/deck.service';
import { DeckDTO } from '../models/dto';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css'
})
export class MenuComponent {

  router:Router;
  deckService: DeckService;
  isPractiseSelected:boolean = false;
  decks: DeckDTO[] = [];
  isPractiseOpen = false;
  isPlayOpen = false;
  isAssistedPlayOpen = false;

  constructor(router:Router, deckService: DeckService){
    this.router = router,
    this.deckService = deckService;
  }

  ngOnInit(){
    this.loadDecks();
  }

  loadDecks(){
    this.deckService.getAll().subscribe({
      next: (decks) => {
        this.decks = decks;
      },
      error: (error) => {
        console.error('Error fetching decks:', error.message);
      }
    })
  }

  navigateAway(deckId:number) {
    if(this.isPractiseSelected){
      this.router.navigateByUrl("/quiz/"+deckId);
    }else{
      this.router.navigateByUrl("/blue-yeti"+(this.isAssistedPlayOpen ? "-assisted/" : "/")+deckId);
    }
  }
  startPractise(){
    if(this.isPractiseOpen){
      this.isPractiseOpen = false;
      return;
    }
    this.isPractiseSelected = true;
    this.isPractiseOpen = true;
    this.isPlayOpen = false;
    this.isAssistedPlayOpen = false;
  }

  startPlay(){
    if(this.isPlayOpen){
      this.isPlayOpen = false;
      return;
    }
    this.isPractiseSelected = false;
    this.isPractiseOpen = false;
    this.isPlayOpen = true;
    this.isAssistedPlayOpen = false;
  }

  startAssistedPlay(){
    if(this.isAssistedPlayOpen){
      this.isAssistedPlayOpen = false;
      return;
    }
    this.isPractiseSelected = false;
    this.isPractiseOpen = false;
    this.isPlayOpen = false;
    this.isAssistedPlayOpen = true;
  }

  navigateTo(link: string){
    this.isPractiseOpen = false;
    this.isPlayOpen = false;
    this.router.navigateByUrl(link);
  }
}
