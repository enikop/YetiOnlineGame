import { Routes } from '@angular/router';
import { QuizComponent } from './quiz/quiz.component';
import { MenuComponent } from './menu/menu.component';
import { YetiGameComponent } from './yeti-game/yeti-game.component';
import { BlueYetiComponent } from './blue-yeti/blue-yeti.component';
import { InstructionsComponent } from './instructions/instructions.component';

export const routes: Routes = [
  {
    path: 'quiz/:deckId',
    component: QuizComponent,
  }, {
    path: '',
    component: MenuComponent,
  }, {
    path: 'blue-yeti-assisted/:deckId',
    component: BlueYetiComponent,
  }, {
    path: 'blue-yeti/:deckId',
    component: BlueYetiComponent,
  }, {
    path: 'wall-builder/:deckId',
    component: YetiGameComponent,
  }, {
    path: 'instructions',
    component: InstructionsComponent,
  }
];
