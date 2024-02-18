import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DeckDTO } from '../models/dto';

@Injectable({
  providedIn: 'root'
})
export class DeckService {

  constructor(private http: HttpClient) { }
  getAll() {
    return this.http.get<DeckDTO[]>('api/allDecks');
 }

 getOne(id: number) {
   return this.http.get<DeckDTO>('api/deck/' + id);
 }

 create(item: DeckDTO) {
   return this.http.post<DeckDTO>('api/deck', item);
 }

 update(item: DeckDTO) {
   return this.http.put<DeckDTO>('api/deck', item);
 }

 delete(id: number) {
   return this.http.delete('api/deck/' + id);
 }
}
