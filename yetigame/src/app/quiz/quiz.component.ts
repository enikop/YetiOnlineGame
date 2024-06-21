import {  AfterViewInit, Component, ElementRef, OnInit, QueryList, Renderer2, ViewChild, ViewChildren} from '@angular/core';
import { renderLatex } from '../latexhandler';
import { CardService } from '../services/card.service';
import { ActivatedRoute, Router } from '@angular/router';
import { CardDTO } from '../models/dto';
import { CommonModule } from '@angular/common';
import { ExplanationsComponent } from '../explanations/explanations.component';
import { DeckService } from '../services/deck.service';
import { ComparisonTestModalComponent } from '../comparison-test-modal/comparison-test-modal.component';

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [CommonModule, ExplanationsComponent, ComparisonTestModalComponent],
  templateUrl: './quiz.component.html',
  styleUrl: './quiz.component.css',
})
export class QuizComponent implements OnInit, AfterViewInit {

  @ViewChild('guesserCanvas')
  guesserCanvasRef!: ElementRef;

  @ViewChildren('previewCanvas')
  canvasElementRefs!: QueryList<ElementRef<HTMLCanvasElement>>;

  current_index = 0;
  EXERCISE_NUMBER = 10;
  PREVIEW_WIDTH = 250;
  CARD_WIDTH = 350;
  cards:CardDTO[] = [];
  isResultShown = false;
  equationImage = new Image();
  divImage = new Image();
  convImage = new Image();
  isCorrect = false;
  score = 0;
  timer = 120;
  isGameOver = false;
  sumType = '';
  answers: boolean[] = [];
  integrals: boolean = false;
  isHelpModalOn = false;
  private isTimerToBeReset = false;
  private previewCanvases: HTMLCanvasElement[] = [];
  private guesserCanvas!: HTMLCanvasElement;

  constructor(
    private cardService: CardService,
    private deckService: DeckService,
    private currentRoute: ActivatedRoute,
    private router: Router) { }

  ngOnInit() {
    const deckId = this.currentRoute.snapshot.params['deckId'];
    this.deckService.getOne(deckId).subscribe({
      next: (deck) => {
        this.integrals = (deck.type == 'integrals');
      },
      error: (error) => {
        console.error('Error fetching cards:', error.message);
      }
    })
    this.cardService.getRandomSelection(deckId, this.EXERCISE_NUMBER).subscribe({
      next: (cards) => {
        this.cards = cards;
        this.prepareResources().then((resolve:any) => {
          this.initializeQuiz();
        });
      },
      error: (error) => {
        console.error('Error fetching cards:', error.message);
      }
    });
  }

  ngAfterViewInit() {
    const canvasList = this.canvasElementRefs.toArray();
    this.previewCanvases = canvasList.map(elem => elem.nativeElement);
    this.guesserCanvas = this.guesserCanvasRef.nativeElement;
    const interval = setInterval(() => {
      if(this.isTimerToBeReset){
        clearInterval(interval);
      } else if(--this.timer < 1){
        clearInterval(interval);
        const addition = Array(this.EXERCISE_NUMBER - this.answers.length).fill(false);
        this.answers = [...this.answers, ...addition];
        this.endGame();
      }
    }, 1000);
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

  backToMenu(){
    this.router.navigateByUrl('');
  }

  repeatArray() {
    return Array(this.EXERCISE_NUMBER);
  }

  initializeQuiz() {
    this.current_index = -1;
    this.nextExercise();
  }

  guessConvergence(isConvergent: boolean) {
    if (this.cards[this.current_index].cardGroup.convergent === isConvergent) {
      this.isCorrect = true;
      this.score++;
      this.answers.push(true);
    } else{
      this.sumType = this.cards[this.current_index].cardGroup.subtype;
      this.isCorrect = false;
      this.answers.push(false);
    }
    this.isResultShown = true;
    this.showResult();
    this.addSummary();
  }

  showResult() {
    this.isResultShown = true;
    const ctx = this.guesserCanvas.getContext('2d')!;
    let latexWidth = this.equationImage.naturalWidth * 7;
    let latexHeight = this.equationImage.naturalHeight * 7;
    let currentY = this.guesserCanvas.height / 2 - latexHeight / 2;
    let currentX = this.guesserCanvas.width / 2 - latexWidth / 2;
    ctx.fillRect(0, 0, this.guesserCanvas.width, this.guesserCanvas.height);
    if (this.cards[this.current_index].cardGroup.convergent) {
      ctx.drawImage(this.convImage, 0, 0, this.guesserCanvas.width, this.guesserCanvas.height);
    } else {
      ctx.drawImage(this.divImage, 0, 0, this.guesserCanvas.width, this.guesserCanvas.height);
    }
    ctx.drawImage(this.equationImage, currentX, currentY, latexWidth, latexHeight);
  }

  addSummary() {
    let summaryCanvas = this.previewCanvases[this.current_index];
    const summaryCtx = summaryCanvas.getContext('2d')!;
    summaryCtx.drawImage(this.guesserCanvas, 0, 0, summaryCanvas.width, summaryCanvas.height);
  }

  endGame() {
    this.isTimerToBeReset = true;
    this.isGameOver = true;
  }

  nextExercise() {
    this.isResultShown = false;
    this.sumType = '';
    this.current_index++;
    if (this.current_index >= this.EXERCISE_NUMBER) {
      this.endGame();
      return;
    }
    this.equationImage = new Image();
    this.equationImage.addEventListener("load", () => {
      const ctx = this.guesserCanvas.getContext("2d")!;
      let latexWidth = this.equationImage.naturalWidth*7;
      let latexHeight = this.equationImage.naturalHeight*7;
      let currentY = this.guesserCanvas.height / 2 - latexHeight / 2;
      let currentX = this.guesserCanvas.width / 2 - latexWidth / 2;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, this.guesserCanvas.width, this.guesserCanvas.height);
      ctx.drawImage(this.equationImage, currentX, currentY, latexWidth, latexHeight);

    });
    this.equationImage.src = renderLatex(this.cards[this.current_index].latex);
  }

  closeHelp(){
    this.isHelpModalOn = false;
  }

  openHelp(){
    this.isHelpModalOn = true;
  }
}
