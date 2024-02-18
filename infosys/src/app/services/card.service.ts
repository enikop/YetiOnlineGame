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

  getOne(id: number) {
    return this.http.get<CardDTO>('api/device/' + id);
  }

  getRandomSelection(deckId:number, count:number){
    return this.http.get<CardDTO[]>('api/quiz/'+deckId+'/'+count);
  }

  create(item: CardDTO) {
    return this.http.post<CardDTO>('api/device', item);
  }

  update(item: CardDTO) {
    return this.http.put<CardDTO>('api/device', item);
  }

  delete(id: number) {
    return this.http.delete('api/device/' + id);
  }
}
