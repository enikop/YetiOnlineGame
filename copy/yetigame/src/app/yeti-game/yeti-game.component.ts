import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DeckService } from '../services/deck.service';
import { CardDTO, CardGroupDTO, DeckDTO } from '../models/dto';

@Component({
  selector: 'app-yeti-game',
  standalone: true,
  imports: [],
  templateUrl: './yeti-game.component.html',
  styleUrl: './yeti-game.component.css'
})
export class YetiGameComponent {

  deck!: DeckDTO;
  allGroups: CardGroupDTO[] = [];
  YETI_COUNT:number = 16;
  CONV_AVAL_COUNT:number = 1;
  DIV_AVAL_COUNT:number = 1;
  GREY_AVAL_COUNT:number = 2;
  shuffled_cards: (string|CardDTO)[] = [];
  backgroundImage: HTMLImageElement = new Image();
  boardWidth: number = 800;
  boardHeight: number = 0;

  constructor(
    private deckService: DeckService, 
    private currentRoute: ActivatedRoute
) { }

  ngOnInit() {
    this.backgroundImage.addEventListener('load', ()=>{
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d')!;
      canvas.style.width = this.boardWidth + 'px';
      canvas.style.height = this.boardWidth*this.backgroundImage.naturalHeight/this.backgroundImage.naturalWidth + 'px';
      canvas.width = this.backgroundImage.naturalWidth;
      canvas.height = this.backgroundImage.naturalHeight;
      ctx.drawImage(this.backgroundImage, 0, 0, canvas.width, canvas.height);
      document.getElementById('game-board')!.appendChild(canvas);
      console.log(document.getElementById('game-board'));
      this.loadDeck();
    });
    this.backgroundImage.src = 'assets/yeti_board.png';
  }

  loadDeck() {
    const deckId = this.currentRoute.snapshot.params['deckId'];
    this.deckService.getOne(deckId).subscribe({
      next: (deck) => {
        this.deck = deck;
        this.shuffled_cards=this.deck.cards.slice();
        this.initYetis();
        this.shuffled_cards = this.shuffle(this.shuffled_cards);
        console.log(this.shuffled_cards);

      },
      error: (error) => {
        console.error('Error fetching deck:', error.message);
      }  
    }); 
  }

  initYetis(){
    for(let i=0; i<this.YETI_COUNT - 5; i++){
      this.shuffled_cards.push('y');
    }
    for(let i=0; i<this.GREY_AVAL_COUNT; i++){
      this.shuffled_cards.push('ga');
    }
    for(let i=0; i<this.CONV_AVAL_COUNT; i++){
      this.shuffled_cards.push('ca');
    }
    for(let i=0; i<this.DIV_AVAL_COUNT; i++){
      this.shuffled_cards.push('da');
    }
  }

  shuffle(array: any[]){ 
    const shuffledArray = array.slice();
    for (let i = shuffledArray.length - 1; i > 0; i--) { 
      const j = Math.floor(Math.random() * (i + 1)); 
      [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]]; 
    } 
    return shuffledArray; 
  }; 

}
