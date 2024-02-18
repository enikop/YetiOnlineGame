import { Component } from '@angular/core';
import { BlueYetiService } from '../services/blue-yeti.service';

@Component({
  selector: 'app-blue-yeti',
  standalone: true,
  imports: [],
  templateUrl: './blue-yeti.component.html',
  styleUrl: './blue-yeti.component.css'
})
export class BlueYetiComponent {
  ngOnInit(){
    var blueYetiService = new BlueYetiService();
  }
}
