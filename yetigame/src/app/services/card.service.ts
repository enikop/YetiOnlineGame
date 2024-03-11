import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CardDTO } from '../models/dto';

@Injectable({
  providedIn: 'root'
})
export class CardService {

  constructor(private http: HttpClient) { }

  getAll() {
     return this.http.get<CardDTO[]>('api/quiz');
  }

  getRandomSelection(deckId:number, count:number){
    return this.http.get<CardDTO[]>('api/quiz/'+deckId+'/'+count);
  }
}
