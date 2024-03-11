import {  Component, OnInit, Renderer2} from '@angular/core';
import { renderLatex } from '../latexhandler';
import { CardService } from '../services/card.service';
import { ActivatedRoute, Router } from '@angular/router';
import { CardDTO } from '../models/dto';

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [],
  templateUrl: './quiz.component.html',
  styleUrl: './quiz.component.css',
})
export class QuizComponent implements OnInit {

  current_index = 0;
  EXERCISE_NUMBER = 10;
  PREVIEW_WIDTH = 250;
  CARD_WIDTH = 350;
  cards:CardDTO[] = [];
  equationImage = new Image();
  divImage = new Image();
  convImage = new Image();

  constructor(
    private cardService: CardService, 
    private currentRoute: ActivatedRoute
) { }

  ngOnInit() {
    const deckId = this.currentRoute.snapshot.params['deckId'];
    this.cardService.getRandomSelection(deckId, this.EXERCISE_NUMBER).subscribe({
      next: (cards) => {
        this.cards = cards;
        this.prepareResources().then((resolve:any) => {
          this.initializeQuiz();
          document.getElementById('conv-button')!.classList.remove('disabled');
          document.getElementById('div-button')!.classList.remove('disabled');});
      },
      error: (error) => {
        console.error('Error fetching cards:', error.message);
      }  
    }); 
  }

  //synchronizing with promise
  private prepareResources() {
    return new Promise((resolve, reject) => {
      this.divImage.addEventListener('load', () => {
        this.convImage.addEventListener('load', () => {
          resolve("");
        });
        this.convImage.src = 'assets/Keretkonv.png';
      });
      this.divImage.src = 'assets/Keretdiv.png';

    });
  }

  initializeQuiz() {
    let cardGrid = document.getElementById('card-grid')!;
    cardGrid.style.visibility = 'hidden';
    this.current_index = -1;
    this.nextExercise();
    let summaryHtml = '';
    for (let i = 0; i < this.EXERCISE_NUMBER; i++) {
      summaryHtml += `<canvas width='${this.PREVIEW_WIDTH}px' height='${this.PREVIEW_WIDTH / 1.5}px'></canvas>`;
    }
    document.getElementById('card-grid')!.style.height = (1.1 * (this.PREVIEW_WIDTH / 1.5)) + 'px';
    document.getElementById('card-grid')!.innerHTML = summaryHtml;
  }

  guessConvergence(isConvergent: boolean) {
    document.getElementById('guess-buttons')!.style.display = 'none';
    document.getElementById('feedback')!.style.display = 'block';
    document.getElementById('feedback')!.style.height = document.getElementById('guess-buttons')!.style.height;
    document.getElementById('next-button')!.style.visibility = 'visible';
    if (this.cards[this.current_index].cardGroup.convergent === isConvergent) {
      this.increaseScore();
      document.getElementById('guesser-canvas')!.classList.add('canvas-correct');
      document.getElementById('feedback')!.innerHTML = "<p style='background-color: green; color:white;'>Your answer is correct.</p>"
    } else{
      document.getElementById('guesser-canvas')!.classList.add('canvas-incorrect');
      document.getElementById('feedback')!.innerHTML = "<p style='background-color: red;color:white;'>Your answer is incorrect.</p>"
    }
    this.showResult();
    this.addSummary();
  }

  showResult() {
    let card = document.getElementById('guesser-canvas') as HTMLCanvasElement;
    const ctx = card.getContext('2d')!;
    let latexWidth = this.equationImage.naturalWidth * 7;
    let latexHeight = this.equationImage.naturalHeight * 7;
    let currentY = card.height / 2 - latexHeight / 2;
    let currentX = card.width / 2 - latexWidth / 2;
    ctx.fillRect(0, 0, card.width, card.height);
    if (this.cards[this.current_index].cardGroup.convergent) {
      ctx.drawImage(this.convImage, 0, 0, card.width, card.height);
    } else {
      ctx.drawImage(this.divImage, 0, 0, card.width, card.height);
    }
    ctx.drawImage(this.equationImage, currentX, currentY, latexWidth, latexHeight);
  }

  addSummary() {
    let cardGrid = document.getElementById('card-grid')!;
    cardGrid.style.visibility = 'visible';
    let summaryCanvas = cardGrid.getElementsByTagName('canvas')[this.current_index] as HTMLCanvasElement;
    summaryCanvas.style.width = this.PREVIEW_WIDTH+'px';
    summaryCanvas.style.height = this.PREVIEW_WIDTH/1.5+'px';
    cardGrid.style.maxWidth = 2*this.PREVIEW_WIDTH+25+'px';
    cardGrid.style.height = summaryCanvas.style.height;
    summaryCanvas.width = (document.getElementById('guesser-canvas') as HTMLCanvasElement).width;
    summaryCanvas.height = (document.getElementById('guesser-canvas') as HTMLCanvasElement).height;
    const summaryCtx = summaryCanvas.getContext('2d')!;
    summaryCtx.drawImage(document.getElementById('guesser-canvas') as HTMLCanvasElement, 0, 0, summaryCanvas.width, summaryCanvas.height);
  }

  nextExercise() {
    document.getElementById('guess-buttons')!.style.display = 'block';
    document.getElementById('feedback')!.style.display = 'none';
    document.getElementById('guesser-canvas')!.classList.remove('canvas-correct');
    document.getElementById('guesser-canvas')!.classList.remove('canvas-incorrect');
    document.getElementById('next-button')!.style.visibility = 'hidden';
    this.current_index++;
    if (this.current_index >= this.EXERCISE_NUMBER) {
      alert('end');
      return;
    }
    let card = document.getElementById('guesser-canvas') as HTMLCanvasElement;
    card.style.height = this.CARD_WIDTH + 'px';
    card.style.width = this.CARD_WIDTH * 1.5 + 'px';
    card.height = this.CARD_WIDTH*3;
    card.width = this.CARD_WIDTH*1.5*3;
    this.equationImage = new Image();
    this.equationImage.addEventListener("load", () => {
      const ctx = card.getContext("2d")!;
      let latexWidth = this.equationImage.naturalWidth*7;
      let latexHeight = this.equationImage.naturalHeight*7;
      let currentY = card.height / 2 - latexHeight / 2;
      let currentX = card.width / 2 - latexWidth / 2;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, card.width, card.height);
      ctx.drawImage(this.equationImage, currentX, currentY, latexWidth, latexHeight);

    });
    this.equationImage.src = renderLatex(this.cards[this.current_index].latex);
  }

  increaseScore() {
    document.getElementById('score')!.innerText = (parseInt(document.getElementById('score')!.innerText) + 1).toString();
  }

  decreaseScore() {
    document.getElementById('score')!.innerText = (parseInt(document.getElementById('score')!.innerText) - 1).toString();
  }

}
