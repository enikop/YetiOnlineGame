import { Routes } from '@angular/router';
import { QuizComponent } from './quiz/quiz.component';
import { MenuComponent } from './menu/menu.component';
import { YetiGameComponent } from './yeti-game/yeti-game.component';
import { BlueYetiComponent } from './blue-yeti/blue-yeti.component';

export const routes: Routes = [{
    path: 'quiz/:deckId',
    component: QuizComponent,
  }, {
    path: 'menu',
    component: MenuComponent,
  }, {
    path: 'yeti/:deckId',
    component: YetiGameComponent,
  }, {
    path: 'blue-yeti/:deckId',
    component: BlueYetiComponent,
  }, {
    path: 'wall-builder/:deckId',
    component: YetiGameComponent,
  }];
