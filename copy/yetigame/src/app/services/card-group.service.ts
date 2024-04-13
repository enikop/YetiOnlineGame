import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CardGroupDTO } from '../models/dto';

@Injectable({
  providedIn: 'root'
})
export class CardGroupService {

  constructor(private http: HttpClient) { }
  getAll() {
    return this.http.get<CardGroupDTO[]>('api/allGroups');
  }
  getAllFromDeck(deckId:number) {
    return this.http.get<CardGroupDTO[]>('api/groupsFromDeck/'+deckId);
  }
}
