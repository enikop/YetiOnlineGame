import { Component } from '@angular/core';
import { BlueYetiService } from '../services/blue-yeti.service';
import { CardGroupService } from '../services/card-group.service';
import { ActivatedRoute } from '@angular/router';
import { CardDTO, CardGroupDTO } from '../models/dto';

@Component({
  selector: 'app-blue-yeti',
  standalone: true,
  imports: [],
  templateUrl: './blue-yeti.component.html',
  styleUrl: './blue-yeti.component.css'
})
export class BlueYetiComponent {
  DECK_SIZE: number = 29;
  currentDeck:(CardDTO | string)[]=['y'];

  constructor(
    private cardGroupService: CardGroupService,
    private currentRoute: ActivatedRoute
  ) { } 

  ngOnInit(){
    var blueYetiService = new BlueYetiService();
    const deckId = this.currentRoute.snapshot.params['deckId'];
    this.cardGroupService.getAllFromDeck(deckId).subscribe({
      next: (groups) => {
        var index = 0;
        while(this.currentDeck.length < this.DECK_SIZE){
          if(index >= groups.length) index = 0;
          var group = groups[index];
          this.currentDeck.push(this.chooseRandomElement(group.cards.filter(card => card.simple)));
          this.currentDeck.push(this.chooseRandomElement(group.cards.filter(card => !card.simple)));
          index++;
        }
        this.currentDeck = this.shuffle(this.currentDeck);
        console.log(this.currentDeck);
      },
      error: (error) => {
        console.error('Error fetching cards:', error.message);
      }  
    }); 

  }
  chooseRandomElement(array: any[]): any | undefined {
    if (array.length === 0) {
      return undefined;
    }
    const randomIndex = Math.floor(Math.random() * array.length);
    return array[randomIndex];
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
