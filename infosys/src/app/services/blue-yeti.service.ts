import { Injectable } from '@angular/core';
import { Socket, io } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class BlueYetiService {
  private socket: Socket;

  constructor() {
    this.socket = io("http://localhost:3000");
   }
}
